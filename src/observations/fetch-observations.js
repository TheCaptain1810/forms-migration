const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

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

    // Observations endpoint
    this.observationsEndpoint = {
      name: "observations",
      category: "project",
      url: `${this.procoreBaseUrl}/rest/v1.0/observations/items?project_id=${this.projectId}`,
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

  async fetchObservations() {
    console.log("Fetching observations data...");

    try {
      const result = await this.makeApiRequest(
        this.observationsEndpoint,
        this.accessToken
      );

      // Check if token needs refreshing
      if (result.status === 401) {
        console.log("Token needs refreshing. Attempting to refresh...");
        try {
          await this.refreshAccessToken();
          console.log("Successfully refreshed token, retrying request...");
          return this.fetchObservations();
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError.message);
          throw new Error("Could not refresh token to continue with request");
        }
      }

      const observations = result.data || [];
      const detailedObservations = [];

      for (const observation of observations) {
        const observationId = observation.id;

        // Fetch response logs
        const responseLogsEndpoint = {
          name: `response_logs_${observationId}`,
          category: "dependent",
          url: `${this.procoreBaseUrl}/rest/v1.0/projects/${this.projectId}/observations/response_logs`,
        };
        const responseLogs = await this.makeApiRequest(
          responseLogsEndpoint,
          this.accessToken
        );

        // Combine data
        detailedObservations.push({
          ...observation,
          response_logs: responseLogs.data || [],
        });
      }

      console.log("Observations data with response logs fetched successfully");
      return {
        project: {
          observations: { data: detailedObservations, status: result.status },
        },
      };
    } catch (error) {
      console.error("Error in fetchObservations:", error);
      throw error;
    }
  }

  async run() {
    try {
      console.log("Starting API fetch process...");
      console.log(`Using Procore base URL: ${this.procoreBaseUrl}`);
      console.log(`Using company ID: ${this.companyId}`);
      console.log(`Using project ID: ${this.projectId}`);

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

      const observationsData = await this.fetchObservations();

      this.saveDataToFile("observations.json", observationsData);

      console.log(
        "\nProcess complete. Data saved to files in src/data/generated directory."
      );
      return observationsData;
    } catch (error) {
      console.error("Fatal error:", error);
    }
  }
}

const client = new ProcoreApiClient();
client.run();
