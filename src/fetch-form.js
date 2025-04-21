const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

class ProcoreApiClient {
  constructor() {
    // Configuration
    this.companyId = "4266122";
    this.projectId = "121313";
    this.accessToken = process.env.PROCORE_ACCESS_TOKEN;
    this.refreshToken = process.env.PROCORE_REFRESH_TOKEN;
    this.clientId = process.env.PROCORE_CLIENT_ID;
    this.clientSecret = process.env.PROCORE_CLIENT_SECRET;
    this.procoreBaseUrl = process.env.PROCORE_BASE_URL;
    this.dataDir = path.resolve(__dirname, "./data/generated");

    // Ensure data/generated directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Define necessary endpoints
    this.endpoints = [
      {
        name: "lists",
        category: "project",
        url: `${this.procoreBaseUrl}/rest/v1.0/projects/${this.projectId}/checklist/lists`,
      },
      {
        name: "listItems",
        category: "project",
        url: `${this.procoreBaseUrl}/rest/v1.0/projects/${this.projectId}/checklist/list_items`,
      },
    ];
  }

  // Save data to a file
  saveDataToFile(filename, data) {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filePath}`);
  }

  // Refresh access token
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

  // Make a single API request with retry logic
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

  // Sequentially make API requests
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

  // Fetch dependent data
  async fetchDependentData(baseData) {
    const dependentRequests = [];

    // LIST RELATED ENDPOINTS
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

  // Fetch all checklist data
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

      // Transform initial results into a structured object
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

  // Generate response summary
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

  // Main execution method
  async run() {
    try {
      console.log("Starting API fetch process...");
      console.log(`Using Procore base URL: ${this.procoreBaseUrl}`);
      console.log(`Using company ID: ${this.companyId}`);
      console.log(`Using project ID: ${this.projectId}`);

      if (!this.accessToken) {
        console.error("Access token is not available. Check your .env file.");
        process.exit(1);
      }

      const allData = await this.fetchAllChecklistData();

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

// Execute the client
const client = new ProcoreApiClient();
client.run();
