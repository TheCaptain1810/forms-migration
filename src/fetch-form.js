const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const companyId = "4266122";
const projectId = "121313";
const accessToken = process.env.PROCORE_ACCESS_TOKEN;
const refreshToken = process.env.PROCORE_REFRESH_TOKEN;
// Use the PRODUCTION credentials since we're using the PRODUCTION
const clientId = process.env.PROCORE_CLIENT_ID;
const clientSecret = process.env.PROCORE_CLIENT_SECRET;
const procore_base_url = process.env.PROCORE_BASE_URL;

// Ensure data/generated directory exists
const dataDir = path.resolve(__dirname, "./data/generated");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Function to save data to a file
function saveDataToFile(filename, data) {
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Data saved to ${filePath}`);
}

async function refreshAccessToken(refreshToken) {
  try {
    const { data } = await axios.post(
      `${PROCORE_PRODUCTION_BASE_URL}/oauth/token`,
      null,
      {
        params: {
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    return data.access_token;
  } catch (error) {
    console.error("Error refreshing token:", error.message);
    throw new Error("Failed to refresh Procore token");
  }
}

// Function to make a single API request with retry logic
async function makeApiRequest(token, endpoint, retryCount = 0) {
  const maxRetries = 2; // Maximum number of retries
  const headers = {
    Authorization: `Bearer ${token}`,
    "Procore-Company-Id": companyId,
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

    // If it's a 401 unauthorized, we'll handle token refresh at a higher level
    if (status === 401) {
      return {
        name: endpoint.name,
        category: endpoint.category,
        subcategory: endpoint.subcategory || null,
        error: error.message,
        status: status,
      };
    }

    // For other errors, retry if we haven't reached max retries
    if (retryCount < maxRetries) {
      console.log(
        `Retrying ${endpoint.name} (Attempt ${retryCount + 1} of ${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
      return makeApiRequest(token, endpoint, retryCount + 1);
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

// Function to sequentially make API requests
async function makeSequentialRequests(token, endpoints) {
  const results = [];
  let needsTokenRefresh = false;

  for (const endpoint of endpoints) {
    if (needsTokenRefresh) {
      // Skip remaining requests if we know we need a token refresh
      results.push({
        name: endpoint.name,
        category: endpoint.category,
        subcategory: endpoint.subcategory || null,
        error: "Skipped due to pending token refresh",
        status: "skipped",
      });
      continue;
    }

    const result = await makeApiRequest(token, endpoint);
    results.push(result);

    // Check if we need to refresh token
    if (result.status === 401) {
      needsTokenRefresh = true;
    }
  }

  return {
    results,
    needsTokenRefresh,
  };
}

async function fetchDependentData(token, baseData) {
  const dependentRequests = [];

  // SCHEDULE RELATED ENDPOINTS
  if (
    baseData.project &&
    baseData.project.schedules &&
    baseData.project.schedules.data
  ) {
    const schedules = baseData.project.schedules.data;
    for (const schedule of schedules) {
      if (schedule.id) {
        dependentRequests.push({
          name: `scheduleAttachments_${schedule.id}`,
          category: "dependent",
          subcategory: "schedules",
          url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/schedules/${schedule.id}/attachments`,
        });

        dependentRequests.push({
          name: `scheduleChangeHistory_${schedule.id}`,
          category: "dependent",
          subcategory: "schedules",
          url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/schedules/${schedule.id}/change_history`,
        });
      }
    }
  }

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
          url: `${procore_base_url}/rest/v1.0/checklist/lists/${list.id}/signature_requests`,
        });
      }
    }
  }

  // INSPECTION TEMPLATE RELATED ENDPOINTS
  if (
    baseData.company &&
    baseData.company.inspectionTemplates &&
    baseData.company.inspectionTemplates.data
  ) {
    const templates = baseData.company.inspectionTemplates.data;
    for (const template of templates) {
      if (template.id) {
        dependentRequests.push({
          name: `inspectionTemplateItemReferences_${template.id}`,
          category: "dependent",
          subcategory: "inspectionTemplates",
          url: `${procore_base_url}/rest/v1.0/companies/${companyId}/inspection_templates/${template.id}/item_references`,
        });

        dependentRequests.push({
          name: `inspectionTemplateItems_${template.id}`,
          category: "dependent",
          subcategory: "inspectionTemplates",
          url: `${procore_base_url}/rest/v1.0/companies/${companyId}/inspection_templates/${template.id}/items`,
        });
      }
    }
  }

  // LIST TEMPLATE RELATED ENDPOINTS
  if (
    baseData.company &&
    baseData.company.listTemplates &&
    baseData.company.listTemplates.data
  ) {
    const templates = baseData.company.listTemplates.data;
    for (const template of templates) {
      if (template.id) {
        dependentRequests.push({
          name: `listTemplateSections_${template.id}`,
          category: "dependent",
          subcategory: "listTemplates",
          url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/list_templates/${template.id}/sections`,
        });
      }
    }
  }

  // INSPECTION ITEMS RELATED ENDPOINTS
  if (
    baseData.project &&
    baseData.project.inspectionItems &&
    baseData.project.inspectionItems.data
  ) {
    const items = baseData.project.inspectionItems.data;
    for (const item of items) {
      if (item.id) {
        dependentRequests.push({
          name: `itemEvidenceConfiguration_${item.id}`,
          category: "dependent",
          subcategory: "inspectionItems",
          url: `${procore_base_url}/rest/v2.0/companies/${companyId}/projects/${projectId}/inspection_items/${item.id}/evidence_configuration`,
        });

        dependentRequests.push({
          name: `itemSignatureRequests_${item.id}`,
          category: "dependent",
          subcategory: "inspectionItems",
          url: `${procore_base_url}/rest/v2.0/companies/${companyId}/projects/${projectId}/inspection_items/${item.id}/signature_requests`,
        });
      }
    }
  }

  // INSPECTION TEMPLATE ITEMS RELATED ENDPOINTS
  if (
    baseData.project &&
    baseData.project.inspectionTemplateItems &&
    baseData.project.inspectionTemplateItems.data
  ) {
    const templateItems = baseData.project.inspectionTemplateItems.data;
    for (const item of templateItems) {
      if (item.id) {
        dependentRequests.push({
          name: `templateItemEvidenceConfiguration_${item.id}`,
          category: "dependent",
          subcategory: "inspectionTemplateItems",
          url: `${procore_base_url}/rest/v2.0/companies/${companyId}/projects/${projectId}/inspection_template_items/${item.id}/evidence_configuration`,
        });
      }
    }
  }

  // INSPECTIONS RELATED ENDPOINTS
  if (
    baseData.project &&
    baseData.project.inspections &&
    baseData.project.inspections.data
  ) {
    const inspections = baseData.project.inspections.data;
    for (const inspection of inspections) {
      if (inspection.id) {
        dependentRequests.push({
          name: `inspectionItemReferences_${inspection.id}`,
          category: "dependent",
          subcategory: "inspections",
          url: `${procore_base_url}/rest/v1.0/projects/${projectId}/inspections/${inspection.id}/item_references`,
        });
      }
    }
  }

  // RESPONSE SETS RELATED ENDPOINTS
  if (
    baseData.company &&
    baseData.company.responseSets &&
    baseData.company.responseSets.data
  ) {
    const responseSets = baseData.company.responseSets.data;
    for (const responseSet of responseSets) {
      if (responseSet.id) {
        dependentRequests.push({
          name: `responseSetResponses_${responseSet.id}`,
          category: "dependent",
          subcategory: "responseSets",
          url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/item/response_sets/${responseSet.id}/responses`,
        });
      }
    }
  }

  // PROJECT INSPECTION TEMPLATES - if fetched in first round
  if (
    baseData.project &&
    baseData.project.projectInspectionTemplates &&
    baseData.project.projectInspectionTemplates.data
  ) {
    const templates = baseData.project.projectInspectionTemplates.data;
    for (const template of templates) {
      if (template.id) {
        dependentRequests.push({
          name: `projectInspectionTemplateItemReferences_${template.id}`,
          category: "dependent",
          subcategory: "projectInspectionTemplates",
          url: `${procore_base_url}/rest/v1.0/projects/${projectId}/inspection_templates/${template.id}/item_references`,
        });
      }
    }
  }

  // Make dependent requests sequentially
  if (dependentRequests.length > 0) {
    console.log(
      `Processing ${dependentRequests.length} dependent requests sequentially...`
    );
    const { results } = await makeSequentialRequests(token, dependentRequests);
    return results;
  }

  return [];
}

async function fetchAllChecklistData(token) {
  console.log("Starting to fetch checklist data...");

  // First batch of endpoints - no dependent IDs needed
  const endpoints = [
    // Company level endpoints
    {
      name: "alternativeResponseSets",
      category: "company",
      url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/alternative_response_sets`,
    },
    {
      name: "sections",
      category: "company",
      url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/sections`,
    },
    {
      name: "listTemplates",
      category: "company",
      url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/list_templates`,
    },
    {
      name: "recycledListTemplates",
      category: "company",
      url: `${procore_base_url}/rest/v1.0/companies/${companyId}/recycle_bin/checklist/list_templates`,
    },
    {
      name: "inspectionTypes",
      category: "company",
      url: `${procore_base_url}/rest/v1.0/companies/${companyId}/inspection_types`,
    },
    {
      name: "responseSets",
      category: "company",
      url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/item/response_sets`,
    },
    {
      name: "responses",
      category: "company",
      url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/responses`,
    },

    // Project level endpoints
    {
      name: "listItemComments",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_item_comments`,
    },
    {
      name: "listItemAttachments",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_item_attachments`,
    },
    {
      name: "listItemObservations",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_item_observations`,
    },
    {
      name: "schedules",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/schedules`,
    },
    {
      name: "listSections",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_sections`,
    },
    {
      name: "lists",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/lists`,
    },
    {
      name: "itemTypes",
      category: "checklist",
      url: `${procore_base_url}/rest/v1.0/checklist/item_types`,
    },
    {
      name: "listItems",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_items`,
    },
    {
      name: "users",
      category: "project",
      url: `${procore_base_url}/rest/v1.1/projects/${projectId}/checklist/users`,
    },
    {
      name: "projectListTemplates",
      category: "project",
      url: `${procore_base_url}/rest/v1.1/projects/${projectId}/checklist/list_templates`,
    },

    // Recycled bin endpoints - fixed recycledListItemComments URL
    {
      name: "recycledListItemComments",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle_bin/checklist/list_item_comments`,
    },
    {
      name: "recycledListItemAttachments",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle_bin/checklist/list_item_attachments`,
    },
    {
      name: "recycledListSections",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.1/projects/${projectId}/recycle_bin/checklist/list_sections`,
    },
    {
      name: "recycledLists",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle_bin/checklist/lists`,
    },
    {
      name: "recycledListTemplates",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle_bin/checklist/list_templates`,
    },

    // General checklist endpoints - added project_id to fix 400 errors
    {
      name: "listTemplates",
      category: "checklist",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_templates`,
    },
  ];

  try {
    console.log(`Processing ${endpoints.length} endpoints sequentially...`);

    // Use sequential requests instead of Promise.all
    const { results, needsTokenRefresh } = await makeSequentialRequests(
      token,
      endpoints
    );

    // If token needs refresh, do it and retry
    if (needsTokenRefresh) {
      console.log("Token needs refreshing. Attempting to refresh...");
      try {
        const newToken = await refreshAccessToken(refreshToken);
        console.log("Successfully refreshed token, retrying requests...");
        return fetchAllChecklistData(newToken);
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

    // Count successes and failures
    const successes = results.filter((r) => !r.error).length;
    const failures = results.filter((r) => r.error).length;

    console.log(`Request summary: ${successes} successful, ${failures} failed`);

    // Log failing endpoints for troubleshooting
    if (failures > 0) {
      console.log("Failing endpoints:");
      results
        .filter((r) => r.error)
        .forEach((r) => {
          console.log(`- ${r.category}/${r.name}: ${r.status} (${r.error})`);
        });
    }

    // Try fetching dependent data if we have some successful responses
    if (successes > 0) {
      console.log("Fetching dependent data based on successful responses...");
      // Fetch dependent data (endpoints that need IDs from initial responses)
      const dependentResults = await fetchDependentData(token, baseData);

      // Add dependent results to the response
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

// Helper function to generate a summary of the response
function generateResponseSummary(data) {
  const summary = {
    categories: {},
    totalEndpoints: 0,
    successfulEndpoints: 0,
    failedEndpoints: 0,
  };

  // Process each category
  for (const category in data) {
    summary.categories[category] = {
      endpoints: Object.keys(data[category]).length,
      successful: 0,
      failed: 0,
    };

    // Count successful and failed endpoints in this category
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

// Main execution
async function main() {
  try {
    console.log("Starting API fetch process...");
    console.log(`Using Procore base URL: ${procore_base_url}`);
    console.log(`Using company ID: ${companyId}`);
    console.log(`Using project ID: ${projectId}`);

    // Check if token is available
    if (!accessToken) {
      console.error("Access token is not available. Check your .env file.");
      process.exit(1);
    }

    const allData = await fetchAllChecklistData(accessToken);

    // Generate a summary
    const summary = generateResponseSummary(allData);

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

    // Save summary and full data to files
    saveDataToFile("summary.json", summary);
    saveDataToFile("procore-data.json", allData);

    console.log(
      "\nProcess complete. Data saved to files in src/data/generated directory."
    );
    return allData;
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

main();
