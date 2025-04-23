const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { default: openBrowser } = require('open');
const http = require('http');
const url = require('url');
const { promisify } = require('util');
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

class ProcoreApiClient {
  constructor() {
    // Procore configuration
    this.companyId = "4266122";
    this.projectId = "121313";
    this.clientId = process.env.PROCORE_CLIENT_ID;
    this.clientSecret = process.env.PROCORE_CLIENT_SECRET;
    this.procoreBaseUrl = process.env.PROCORE_BASE_URL || "https://api.procore.com";
    this.redirectUri = process.env.PROCORE_REDIRECT_URI || "http://localhost:3000/v1/auth/callback";
    
    // Token file path
    this.tokenFilePath = path.resolve(__dirname, "./data/procore-tokens.json");
    
    // Always force a new authentication
    this.accessToken = null;
    this.refreshToken = null;
    
    // Try to load existing tokens from file for refresh option
    this.loadTokens();

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

    // Updated endpoints with correct API paths
    this.endpoints = [
      {
        name: "dailyLogs",
        category: "project",
        url: `${this.procoreBaseUrl}/rest/v1.0/projects/${this.projectId}/daily_logs`, // Using v1.0 API
      },
      {
        name: "users",
        category: "project",
        url: `${this.procoreBaseUrl}/rest/v1.0/projects/${this.projectId}/users`,
      },
      // Updated or removed problematic endpoints
      {
        name: "vendors",
        category: "project",
        url: `${this.procoreBaseUrl}/rest/v1.0/projects/${this.projectId}/vendors`,
      }
    ];

    // Default ACC assigneeId for fallback
    this.defaultAccAssigneeId = "PUJXLNP3U8TM";
  }

  loadTokens() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const tokenData = JSON.parse(fs.readFileSync(this.tokenFilePath));
        
        // We'll load the refresh token in case we need it
        if (tokenData.refreshToken) {
          this.refreshToken = tokenData.refreshToken;
          console.log("Found refresh token, will use it if needed");
        }
      } else {
        console.log("No token file found, will need to authenticate");
      }
      
      return false;
    } catch (error) {
      console.error("Error loading tokens:", error.message);
      return false;
    }
  }

  saveTokens() {
    try {
      // Create the data directory if it doesn't exist
      const dataDir = path.dirname(this.tokenFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const tokenData = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.tokenExpiresAt
      };
      
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData, null, 2));
      console.log("Tokens saved to file");
    } catch (error) {
      console.error("Error saving tokens:", error.message);
    }
  }

  async authenticate() {
    // First try to refresh if we have a refresh token
    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return true;
      } catch (error) {
        console.warn("Token refresh failed, falling back to full authentication");
      }
    }
    
    // If no refresh token or refresh failed, do the full OAuth flow
    return await this.performOAuthFlow();
  }
  
  async performOAuthFlow() {
    return new Promise((resolve, reject) => {
      // Create a server to listen for the OAuth callback
      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url, true);
          
          // Update the callback path to match the redirect URI
          if (parsedUrl.pathname === '/v1/auth/callback') {
            const code = parsedUrl.query.code;
            
            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed: No code received</h1>');
              reject(new Error('No code received'));
              return;
            }
            
            // Exchange code for tokens
            try {
              await this.exchangeCodeForTokens(code);
              
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication successful!</h1><p>You can close this window now.</p>');
              
              // Close the server after a short delay
              setTimeout(() => {
                server.close();
                resolve(true);
              }, 1000);
              
            } catch (error) {
              console.error('Error exchanging code for tokens:', error);
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed</h1><p>Error: ' + error.message + '</p>');
              reject(error);
            }
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Not found</h1>');
          }
        } catch (error) {
          console.error('Error handling request:', error);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Server error</h1>');
          reject(error);
        }
      });
      
      // Start the server on port 3000
      server.listen(3000, () => {
        const { port } = server.address();
        console.log(`OAuth callback server listening on port ${port}`);
        
        // Construct the authorization URL
        const authUrl = `${this.procoreBaseUrl}/oauth/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
        
        console.log("Opening browser for authentication...");
        console.log(`Authorization URL: ${authUrl}`);
        
        // Open the browser for the user to authenticate
        openBrowser(authUrl).catch(err => {
          console.error("Failed to open browser:", err);
          console.log("Please manually open this URL in your browser:", authUrl);
        });
      });
      
      // Handle server errors
      server.on('error', (error) => {
        console.error('Server error:', error);
        reject(error);
      });
    });
  }
  
  async exchangeCodeForTokens(code) {
    try {
      const { data } = await axios.post(
        `${this.procoreBaseUrl}/oauth/token`,
        null,
        {
          params: {
            grant_type: 'authorization_code',
            code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: this.redirectUri
          },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );
      
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      
      // Calculate token expiration time (convert seconds to milliseconds)
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
      
      // Save tokens to file
      this.saveTokens();
      
      console.log("Successfully obtained tokens");
      return true;
    } catch (error) {
      console.error("Error exchanging code for tokens:", error.response?.data || error.message);
      throw error;
    }
  }
  
  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        throw new Error("No refresh token available");
      }
      
      console.log("Refreshing access token...");
      
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
      
      // Update refresh token if provided
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      
      // Calculate token expiration time
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
      
      // Save tokens to file
      this.saveTokens();
      
      console.log("Successfully refreshed access token");
      return this.accessToken;
    } catch (error) {
      console.error("Error refreshing token:", error.response?.data || error.message);
      throw new Error("Failed to refresh Procore token");
    }
  }

  async fetchAccUsers() {
    try {
      if (!this.accBaseUrl || !this.accProjectId || !this.accAuthToken) {
        console.warn("ACC credentials missing in .env file, using default assignee ID only");
        return [];
      }

      try {
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
      } catch (accError) {
        console.error("Error fetching ACC users:");
        if (accError.response) {
          console.error("Status:", accError.response.status);
          console.error("Data:", accError.response.data);
        } else {
          console.error("Error:", accError.message);
        }
        console.warn("Continuing without ACC user data, will use default assignee ID");
        return [];
      }
    } catch (error) {
      console.error("General error in fetchAccUsers:", error.message);
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

    this.saveDataToFile("user-mapping-dailylogs.json", userMapping);
    return userMapping;
  }

  saveDataToFile(filename, data) {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filePath}`);
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

    if (baseData.project && baseData.project.dailyLogs && baseData.project.dailyLogs.data) {
      const dailyLogs = baseData.project.dailyLogs.data;
      console.log(`Found ${dailyLogs.length} daily logs to process for dependent data`);
      
      for (const log of dailyLogs) {
        if (log.id) {
          // Fetch detailed daily log data - using v1.0 API
          dependentRequests.push({
            name: `dailyLogDetails_${log.id}`,
            category: "dependent",
            subcategory: "dailyLogs",
            url: `${this.procoreBaseUrl}/rest/v1.0/projects/${this.projectId}/daily_logs/${log.id}`,
          });
          
          // Only add these if the API supports them
          try {
            // Fetch manpower logs - using v1.0 API
            dependentRequests.push({
              name: `manpowerLogs_${log.id}`,
              category: "dependent",
              subcategory: "manpower",
              url: `${this.procoreBaseUrl}/rest/v1.0/projects/${this.projectId}/daily_logs/${log.id}/manpower_logs`,
            });
          } catch (error) {
            console.warn(`Skipping manpower logs for log ${log.id} due to API issues`);
          }
        }
      }
    } else {
      console.warn("No daily logs found in base data, skipping dependent requests");
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

  transformToAccDailyLogData(procoreData, userMapping) {
    const accDailyLogs = [];

    console.log("Transforming Procore data to ACC daily log data...");

    // Check if we have actual daily logs data
    if (
      procoreData.project &&
      procoreData.project.dailyLogs &&
      procoreData.project.dailyLogs.data &&
      procoreData.project.dailyLogs.data.length > 0
    ) {
      const dailyLogs = procoreData.project.dailyLogs.data;
      
      console.log(`Found ${dailyLogs.length} daily logs to transform`);

      for (const log of dailyLogs) {
        console.log(`Processing daily log ID: ${log.id}, Date: ${log.log_date || 'Unknown date'}`);

        // Find the detailed log data
        const detailedLog = procoreData.dependent?.dailyLogs?.[`dailyLogDetails_${log.id}`]?.data || {};
        const manpowerLogs = procoreData.dependent?.manpower?.[`manpowerLogs_${log.id}`]?.data || [];
        
        // Map creator to ACC user
        const procoreCreatorId = log.created_by?.id;
        const accCreatorId = procoreCreatorId
          ? userMapping[procoreCreatorId] || this.defaultAccAssigneeId
          : this.defaultAccAssigneeId;

        // Format date (handle potential missing date)
        const logDate = log.log_date 
          ? new Date(log.log_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];
        
        // Build the basic daily log structure - handle possible missing fields
        const dailyLogData = {
          id: log.id.toString(),
          date: logDate,
          createdBy: accCreatorId,
          title: `Daily Log - ${logDate}`,
          summary: detailedLog.notes || log.notes || "No notes provided",
          weather: {
            conditions: detailedLog.weather_conditions || log.weather_conditions || "Not specified",
            temperature: detailedLog.temperature || log.temperature || "Not recorded",
            precipitation: detailedLog.precipitation || log.precipitation || "0",
          },
          manpower: (manpowerLogs || []).map(mp => ({
            company: mp.company?.name || "Unknown",
            numberOfWorkers: mp.number_of_workers || 0,
            hours: mp.hours || 0,
            description: mp.description || "",
          })),
        };

        accDailyLogs.push(dailyLogData);
      }
    } else {
      console.warn("No actual daily logs found in Procore data, generating synthetic data for testing");
      
      // Get users for assigning
      const procoreUsers = procoreData.project?.users?.data || [];
      const numUsers = procoreUsers.length;
      
      // Generate synthetic daily logs for testing (last 10 days)
      const today = new Date();
      
      for (let i = 0; i < 10; i++) {
        // Create date for this log (go back i days from today)
        const logDate = new Date(today);
        logDate.setDate(logDate.getDate() - i);
        const dateString = logDate.toISOString().split("T")[0];
        
        // Pick a random user as creator if available
        const randomUserIndex = numUsers > 0 ? Math.floor(Math.random() * numUsers) : -1;
        const randomProcoreUser = randomUserIndex >= 0 ? procoreUsers[randomUserIndex] : null;
        const creatorId = randomProcoreUser 
          ? userMapping[randomProcoreUser.id] || this.defaultAccAssigneeId
          : this.defaultAccAssigneeId;
        
        // Create synthetic daily log
        const dailyLogData = {
          id: `synthetic-${i}`,
          date: dateString,
          createdBy: creatorId,
          title: `Daily Log - ${dateString}`,
          summary: `Synthetic daily log for testing on ${dateString}`,
          weather: {
            conditions: ["Clear", "Cloudy", "Rainy", "Windy", "Foggy"][Math.floor(Math.random() * 5)],
            temperature: `${Math.floor(Math.random() * 30) + 50}°F`,
            precipitation: `${Math.floor(Math.random() * 100)}%`,
          },
          manpower: [
            {
              company: "ABC Construction",
              numberOfWorkers: Math.floor(Math.random() * 10) + 5,
              hours: 8,
              description: "General labor",
            },
            {
              company: "XYZ Electrical",
              numberOfWorkers: Math.floor(Math.random() * 5) + 2,
              hours: 8,
              description: "Electrical work",
            }
          ],
        };
        
        console.log(`Generated synthetic daily log for: ${dateString}`);
        accDailyLogs.push(dailyLogData);
      }
    }

    if (accDailyLogs.length === 0) {
      console.warn("No ACC daily logs generated. Check Procore data.");
    } else {
      console.log(`Successfully created ${accDailyLogs.length} daily logs for ACC`);
    }

    return accDailyLogs;
  }

  async fetchAllDailyLogData() {
    console.log("Starting to fetch daily log data...");

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
          return this.fetchAllDailyLogData();
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
      console.error("Error in fetchAllDailyLogData:", error);
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
      console.log("Starting API fetch process for daily logs...");
      console.log(`Using Procore base URL: ${this.procoreBaseUrl}`);
      console.log(`Using company ID: ${this.companyId}`);
      console.log(`Using project ID: ${this.projectId}`);
      console.log(`Using ACC base URL: ${this.accBaseUrl}`);

      // Always authenticate to get fresh tokens
      console.log("Starting authentication to get fresh tokens...");
      await this.authenticate();

      if (!this.accessToken) {
        console.error("Failed to obtain Procore access token");
        process.exit(1);
      }

      const allData = await this.fetchAllDailyLogData();

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

      const accDailyLogData = this.transformToAccDailyLogData(allData, userMapping);
      this.saveDataToFile("acc-dailylog-data.json", accDailyLogData);

      this.saveDataToFile("dailylogs-summary.json", summary);
      this.saveDataToFile("procore-dailylogs-data.json", allData);

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
client.run().catch(error => {
  console.error("Unhandled error during execution:", error);
  process.exit(1);
}); 