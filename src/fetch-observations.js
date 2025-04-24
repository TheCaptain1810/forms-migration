const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

class ProcoreApiClient {
  constructor() {
    // Procore configuration
    this.companyId = "4266122";
    this.projectId = "121313";
    this.accessToken = process.env.PROCORE_ACCESS_TOKEN;
    this.refreshToken = process.env.PROCORE_REFRESH_TOKEN;
    this.clientId = process.env.PROCORE_CLIENT_ID;
    this.clientSecret = process.env.PROCORE_CLIENT_SECRET;
    this.procoreBaseUrl = process.env.PROCORE_BASE_URL;

    // ACC configuration
    this.accBaseUrl =
      "https://developer.api.autodesk.com/construction/admin/v1";
    this.accProjectId = process.env.ACC_PROJECT_ID;
    this.accAuthToken = process.env.ACC_AUTH_TOKEN
      ? `Bearer ${process.env.ACC_AUTH_TOKEN}`
      : null;

    this.dataDir = path.resolve(__dirname, "./data/generated");
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.endpoints = [
      {
        name: "observations",
        category: "project",
        url: `${this.procoreBaseUrl}/rest/v1.0/observations/items?project_id=${this.projectId}`,
      },
    ];

    this.fieldIdMapping = {
      boolean: "79110a45-afcb-43dc-a3c3-2945a0ec4160",
      multiple_choice: "bbceb11d-b9e2-48eb-b972-fb6a49504fdc",
      single_choice: "68d715fd-9eef-4ee5-b6ce-45c1cccc7347",
      text: "e313b84c-c812-4396-9659-a7ee7481f20b",
      number: "059fa8f6-8387-4dc3-8f33-9e1012e6adc4",
    };

    // Default ACC assigneeId for fallback
    this.defaultAccAssigneeId = "PUJXLNP3U8TM";
  }

  saveDataToFile(filename, data) {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filePath}`);
  }

  async refreshAccessToken() {
    try {
      const { data } = await axios.post(
        `${this.procoreBaseUrl}/oauth/token`,
        null,
        {
          params: {
            grant_type: "refresh_token",
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: this.refreshToken,
          },
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      this.accessToken = data.access_token;
      return this.accessToken;
    } catch (error) {
      console.error("Error refreshing token:", error.message);
      throw new Error("Failed to refresh Procore token");
    }
  }

  async fetchAccUsers() {
    try {
      if (!this.accBaseUrl || !this.accProjectId || !this.accAuthToken) {
        throw new Error("ACC credentials missing in .env file");
      }

      const response = await axios.get(
        `${this.accBaseUrl}/projects/${this.accProjectId}/users`,
        {
          headers: {
            Authorization: this.accAuthToken,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Fetched ACC users successfully");
      return response.data.results || [];
    } catch (error) {
      console.error("Error fetching ACC users:");
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
      } else {
        console.error("Error:", error.message);
      }
      return [];
    }
  }

  async createUserMapping(procoreUsers) {
    const accUsers = await this.fetchAccUsers();
    const userMapping = {};

    console.log(
      `Mapping ${procoreUsers.length} Procore users to ${accUsers.length} ACC users`
    );

    for (const procoreUser of procoreUsers) {
      const procoreId = procoreUser.id;
      const procoreEmail = procoreUser.email_address?.toLowerCase();

      if (!procoreEmail) {
        console.warn(
          `Procore user ID ${procoreId} has no email, using default assigneeId`
        );
        userMapping[procoreId] = this.defaultAccAssigneeId;
        continue;
      }

      const accUser = accUsers.find(
        (user) => user.email?.toLowerCase() === procoreEmail
      );

      if (accUser && accUser.autodeskId) {
        userMapping[procoreId] = accUser.autodeskId;
        console.log(
          `Mapped Procore ID ${procoreId} to ACC ID ${accUser.autodeskId} via email ${procoreEmail}`
        );
      } else {
        console.warn(
          `No ACC user found for Procore email ${procoreEmail}, using default assigneeId`
        );
        userMapping[procoreId] = this.defaultAccAssigneeId;
      }
    }

    this.saveDataToFile("user-mapping.json", userMapping);
    return userMapping;
  }

  async makeApiRequest(endpoint, token, retryCount = 0) {
    const maxRetries = 2;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Procore-Company-Id": this.companyId,
    };

    try {
      console.log(`Making request to: ${endpoint.name}`);
      const response = await axios({
        method: "GET",
        url: endpoint.url,
        headers,
      });

      console.log(`${endpoint.name}: Success (${response.status})`);
      return {
        name: endpoint.name,
        category: endpoint.category,
        subcategory: endpoint.subcategory || null,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      const status = error.response?.status || "unknown";
      console.log(`${endpoint.name}: Failed (${status}) - ${error.message}`);

      if (status === 401) {
        return {
          name: endpoint.name,
          category: endpoint.category,
          subcategory: endpoint.subcategory || null,
          error: error.message,
          status: status,
        };
      }

      if (retryCount < maxRetries) {
        console.log(
          `Retrying ${endpoint.name} (Attempt ${
            retryCount + 1
          } of ${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.makeApiRequest(endpoint, token, retryCount + 1);
      }

      return {
        name: endpoint.name,
        category: endpoint.category,
        subcategory: endpoint.subcategory || null,
        error: error.message,
        status: status,
      };
    }
  }

  async makeSequentialRequests(endpoints, token) {
    const results = [];
    let needsTokenRefresh = false;

    for (const endpoint of endpoints) {
      if (needsTokenRefresh) {
        results.push({
          name: endpoint.name,
          category: endpoint.category,
          subcategory: endpoint.subcategory || null,
          error: "Skipped due to pending token refresh",
          status: "skipped",
        });
        continue;
      }

      const result = await this.makeApiRequest(endpoint, token);
      results.push(result);

      if (result.status === 401) {
        needsTokenRefresh = true;
      }
    }

    return {
      results,
      needsTokenRefresh,
    };
  }

  async fetchDependentData(baseData) {
    const dependentRequests = [];

    if (
      baseData.project &&
      baseData.project.lists &&
      baseData.project.lists.data
    ) {
      const lists = baseData.project.lists.data;
      for (const list of lists) {
        if (list.id) {
          dependentRequests.push({
            name: `listSignatureRequests_${list.id}`,
            category: "dependent",
            subcategory: "lists",
            url: `${this.procoreBaseUrl}/rest/v1.0/checklist/lists/${list.id}/signature_requests`,
          });
        }
      }
    }

    if (dependentRequests.length > 0) {
      console.log(
        `Processing ${dependentRequests.length} dependent requests sequentially...`
      );
      const { results } = await this.makeSequentialRequests(
        dependentRequests,
        this.accessToken
      );
      return results;
    }

    return [];
  }

  transformToAccFormData(procoreData, userMapping) {
    const accForms = [];
    const templateName = "Work Inspection Request";

    console.log("Transforming Procore data to ACC form data...");

    if (
      procoreData.project &&
      procoreData.project.lists &&
      procoreData.project.lists.data
    ) {
      const lists = procoreData.project.lists.data;
      const listItems = procoreData.project?.listItems?.data || [];

      console.log(`SUV Found ${lists.length} lists`);
      console.log(`Found ${listItems.length} list items`);

      for (const list of lists) {
        console.log(`Processing list ID: ${list.id}, Name: ${list.name}`);

        // Map list metadata to ACC formData
        const procoreAssigneeId = list.responsible_contractor?.id;
        const accAssigneeId = procoreAssigneeId
          ? userMapping[procoreAssigneeId] || this.defaultAccAssigneeId
          : this.defaultAccAssigneeId;

        const formData = {
          assigneeId: accAssigneeId,
          assigneeType: "user",
          name: `${list.name}-${new Date(list.created_at).toLocaleDateString(
            "en-US",
            {
              day: "2-digit",
              month: "long",
              year: "numeric",
            }
          )}`,
          description:
            list.description || `Checklist from Procore list ${list.id}`,
          formDate: new Date(list.created_at).toISOString().split("T")[0],
          notes: list.comments || "No additional notes",
        };

        // Filter and map list items to ACC custom values
        const relevantItems = listItems.filter((item) => {
          const isMatch = item.checklist_list_id === list.id;
          if (!isMatch) {
            console.log(
              `Skipping item ID ${item.id}: checklist_list_id ${item.checklist_list_id} does not match list ID ${list.id}`
            );
          }
          return isMatch;
        });

        console.log(
          `Found ${relevantItems.length} items for list ID ${list.id}`
        );

        const customValues = relevantItems
          .map((item) => {
            if (!item.response_value || !item.item_type?.name) {
              console.log(
                `Skipping item ID ${item.id}: Missing response_value or item_type`
              );
              return null;
            }

            let fieldType = item.item_type.name.toLowerCase();
            let value = item.response_value;

            console.log(
              `Mapping item ID ${
                item.id
              }: type=${fieldType}, value=${JSON.stringify(value)}`
            );

            let fieldData = {};
            if (fieldType.includes("boolean")) {
              fieldData = {
                fieldId: this.fieldIdMapping.boolean,
                toggleVal:
                  value === true || value.toLowerCase() === "yes"
                    ? "Yes"
                    : "No",
              };
            } else if (fieldType.includes("multiple")) {
              fieldData = {
                fieldId: this.fieldIdMapping.multiple_choice,
                arrayVal: Array.isArray(value) ? value : [value],
              };
            } else if (fieldType.includes("choice")) {
              fieldData = {
                fieldId: this.fieldIdMapping.single_choice,
                choiceVal: value,
              };
            } else if (fieldType.includes("number")) {
              fieldData = {
                fieldId: this.fieldIdMapping.number,
                numberVal: value.toString(),
              };
            } else {
              fieldData = {
                fieldId: this.fieldIdMapping.text,
                textVal: value.toString(),
              };
            }

            return fieldData;
          })
          .filter((item) => item !== null);

        console.log(
          `Generated ${customValues.length} custom values for list ID ${list.id}`
        );

        accForms.push({
          templateName,
          formData,
          updateData: { customValues },
        });
      }
    } else {
      console.warn("No lists found in Procore data");
    }

    if (accForms.length === 0) {
      console.warn("No ACC forms generated. Check Procore data.");
    }

    return accForms;
  }

  async fetchAllChecklistData() {
    console.log("Starting to fetch checklist data...");

    try {
      console.log(
        `Processing ${this.endpoints.length} endpoints sequentially...`
      );

      const { results, needsTokenRefresh } = await this.makeSequentialRequests(
        this.endpoints,
        this.accessToken
      );

      if (needsTokenRefresh) {
        console.log("Token needs refreshing. Attempting to refresh...");
        try {
          await this.refreshAccessToken();
          console.log("Successfully refreshed token, retrying requests...");
          return this.fetchAllChecklistData();
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError.message);
          throw new Error("Could not refresh token to continue with requests");
        }
      }

      const baseData = {};

      for (const result of results) {
        if (!baseData[result.category]) {
          baseData[result.category] = {};
        }
        baseData[result.category][result.name] = {
          data: result.data,
          error: result.error,
          status: result.status,
        };
      }

      console.log("Initial requests completed. Processing results...");

      const successes = results.filter((r) => !r.error).length;
      const failures = results.filter((r) => r.error).length;

      console.log(
        `Request summary: ${successes} successful, ${failures} failed`
      );

      if (failures > 0) {
        console.log("Failing endpoints:");
        results
          .filter((r) => r.error)
          .forEach((r) => {
            console.log(`- ${r.category}/${r.name}: ${r.status} (${r.error})`);
          });
      }

      if (successes > 0) {
        console.log("Fetching dependent data based on successful responses...");
        const dependentResults = await this.fetchDependentData(baseData);

        if (dependentResults.length > 0) {
          if (!baseData.dependent) {
            baseData.dependent = {};
          }

          for (const result of dependentResults) {
            if (!baseData.dependent[result.subcategory]) {
              baseData.dependent[result.subcategory] = {};
            }

            baseData.dependent[result.subcategory][result.name] = {
              data: result.data,
              error: result.error,
              status: result.status,
            };
          }
        }
      }

      console.log("All data fetching operations completed");
      return baseData;
    } catch (error) {
      console.error("Error in fetchAllChecklistData:", error);
      throw error;
    }
  }

  generateResponseSummary(data) {
    const summary = {
      categories: {},
      totalEndpoints: 0,
      successfulEndpoints: 0,
      failedEndpoints: 0,
    };

    for (const category in data) {
      summary.categories[category] = {
        endpoints: Object.keys(data[category]).length,
        successful: 0,
        failed: 0,
      };

      for (const endpoint in data[category]) {
        summary.totalEndpoints++;

        if (data[category][endpoint].error) {
          summary.failedEndpoints++;
          summary.categories[category].failed++;
        } else {
          summary.successfulEndpoints++;
          summary.categories[category].successful++;
        }
      }
    }

    return summary;
  }

  async run() {
    try {
      console.log("Starting API fetch process...");
      console.log(`Using Procore base URL: ${this.procoreBaseUrl}`);
      console.log(`Using company ID: ${this.companyId}`);
      console.log(`Using project ID: ${this.projectId}`);
      console.log(`Using ACC base URL: ${this.accBaseUrl}`);

      if (!this.accessToken) {
        console.error(
          "Procore access token is not available. Check your .env file."
        );
        process.exit(1);
      }

      if (!this.accAuthToken) {
        console.error("ACC auth token is not available. Check your .env file.");
        process.exit(1);
      }

      const allData = await this.fetchAllChecklistData();

      // Create user mapping
      const procoreUsers = allData.project?.users?.data || [];
      const userMapping = await this.createUserMapping(procoreUsers);

      const summary = this.generateResponseSummary(allData);

      console.log("\n=== SUMMARY ===");
      console.log(`Total endpoints: ${summary.totalEndpoints}`);
      console.log(`Successful: ${summary.successfulEndpoints}`);
      console.log(`Failed: ${summary.failedEndpoints}`);
      console.log("\nCategories:");

      for (const category in summary.categories) {
        console.log(
          `- ${category}: ${summary.categories[category].successful} successful, ${summary.categories[category].failed} failed`
        );
      }

      const accFormData = this.transformToAccFormData(allData, userMapping);
      this.saveDataToFile("acc-form-data.json", accFormData);

      this.saveDataToFile("summary.json", summary);
      this.saveDataToFile("procore-data.json", allData);

      console.log(
        "\nProcess complete. Data saved to files in src/data/generated directory."
      );
      return allData;
    } catch (error) {
      console.error("Fatal error:", error);
    }
  }
}

const client = new ProcoreApiClient();
client.run();
