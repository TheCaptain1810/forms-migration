const axios = require("axios");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const companyId = "4266122";
const projectId = "121313";
const accessToken = process.env.PROCORE_ACCESS_TOKEN;
const refreshToken = process.env.PROCORE_REFRESH_TOKEN;
// Use the sandbox credentials since we're using the sandbox
const clientId = process.env.PROCORE_SANBOX_CLIENT_ID;
const clientSecret = process.env.PROCORE_SANDBOX_CLIENT_SECRET;
const procore_base_url = process.env.PROCORE_SANDBOX_BASE_URL;

async function refreshAccessToken() {
  try {
    const formData = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    console.log("Sending refresh token request");

    const response = await axios({
      method: "POST",
      url: `${procore_base_url}/oauth/token`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: formData,
    });

    if (response.data && response.data.access_token) {
      console.log("Token refreshed successfully");
      return response.data.access_token;
    } else {
      throw new Error("Failed to refresh token: " + JSON.stringify(response.data));
    }
  } catch (error) {
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}

async function makeApiRequest(token, endpoint) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Procore-Company-Id": companyId,
  };

  try {
    const response = await axios({
      method: "GET",
      url: endpoint.url,
      headers,
    });
    
    return {
      name: endpoint.name,
      category: endpoint.category,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      name: endpoint.name,
      category: endpoint.category,
      error: error.message,
      status: error.response?.status || 'unknown'
    };
  }
}

async function fetchDependentData(token, baseData) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Procore-Company-Id": companyId,
  };

  const dependentRequests = [];

  // Get schedule IDs for schedule related endpoints
  if (baseData.schedules && baseData.schedules.data) {
    const schedules = baseData.schedules.data;
    for (const schedule of schedules) {
      if (schedule.id) {
        dependentRequests.push({
          name: `scheduleAttachments_${schedule.id}`,
          category: "scheduleDetails",
          url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/schedules/${schedule.id}/attachments`,
        });
        
        dependentRequests.push({
          name: `scheduleChangeHistory_${schedule.id}`,
          category: "scheduleDetails",
          url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/schedules/${schedule.id}/change_history`,
        });
      }
    }
  }

  // Get list IDs for list related endpoints
  if (baseData.lists && baseData.lists.data) {
    const lists = baseData.lists.data;
    for (const list of lists) {
      if (list.id) {
        dependentRequests.push({
          name: `listSignatureRequests_${list.id}`,
          category: "listDetails",
          url: `${procore_base_url}/rest/v1.0/checklist/lists/${list.id}/signature_requests`,
        });
      }
    }
  }

  // Get inspection template IDs for inspection template related endpoints
  if (baseData.inspectionTemplates && baseData.inspectionTemplates.data) {
    const templates = baseData.inspectionTemplates.data;
    for (const template of templates) {
      if (template.id) {
        dependentRequests.push({
          name: `inspectionTemplateItemReferences_${template.id}`,
          category: "inspectionTemplateDetails",
          url: `${procore_base_url}/rest/v1.0/companies/${companyId}/inspection_templates/${template.id}/item_references`,
        });
        
        dependentRequests.push({
          name: `inspectionTemplateItems_${template.id}`,
          category: "inspectionTemplateDetails",
          url: `${procore_base_url}/rest/v1.0/companies/${companyId}/inspection_templates/${template.id}/items`,
        });
      }
    }
  }

  // Get list template IDs for list template related endpoints
  if (baseData.listTemplates && baseData.listTemplates.data) {
    const templates = baseData.listTemplates.data;
    for (const template of templates) {
      if (template.id) {
        dependentRequests.push({
          name: `listTemplateSections_${template.id}`,
          category: "listTemplateDetails",
          url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/list_templates/${template.id}/sections`,
        });
      }
    }
  }

  // Make all dependent requests
  if (dependentRequests.length > 0) {
    console.log(`Making ${dependentRequests.length} dependent requests...`);
    const requests = dependentRequests.map(endpoint => makeApiRequest(token, endpoint));
    return await Promise.all(requests);
  }
  
  return [];
}

async function fetchAllChecklistData(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Procore-Company-Id": companyId,
  };

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
    
    // Project level endpoints
    {
      name: "listItemComments",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_item_comments`,
    },
    {
      name: "recycledListItemComments",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle-bin/checklist/list_item_comments`,
    },
    {
      name: "listItemAttachments",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_item_attachments`,
    },
    {
      name: "recycledListItemAttachments",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle_bin/checklist/list_item_attachments`,
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
      name: "recycledListSections",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.1/projects/${projectId}/recycle_bin/checklist/list_sections`,
    },
    {
      name: "listTemplates",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/checklist/list_templates`,
    },
    {
      name: "lists",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/lists`,
    },
    {
      name: "recycledLists",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle_bin/checklist/lists`,
    },
    {
      name: "defaultDistribution",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/default_distribution`,
    },
    {
      name: "itemTypes",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/item_types`,
    },
    {
      name: "listItems",
      category: "project",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_items`,
    },
  ];

  try {
    // Create an array of promises for all requests
    const requests = endpoints.map(endpoint => makeApiRequest(token, endpoint));
    
    // Execute all initial requests in parallel
    const results = await Promise.all(requests);
    
    // Check if any request returned 401 (unauthorized)
    const needsTokenRefresh = results.some(result => result.status === 401);
    
    if (needsTokenRefresh) {
      console.log("Token expired, refreshing...");
      const newToken = await refreshAccessToken();
      return fetchAllChecklistData(newToken);
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
        status: result.status
      };
    }
    
    // Fetch dependent data (endpoints that need IDs from initial responses)
    const dependentResults = await fetchDependentData(token, baseData);
    
    // Add dependent results to the response
    if (dependentResults.length > 0) {
      if (!baseData.dependent) {
        baseData.dependent = {};
      }
      
      for (const result of dependentResults) {
        if (!baseData.dependent[result.category]) {
          baseData.dependent[result.category] = {};
        }
        
        baseData.dependent[result.category][result.name] = {
          data: result.data,
          error: result.error,
          status: result.status
        };
      }
    }
    
    return baseData;
  } catch (error) {
    console.error("Error fetching checklist data:", error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log("Fetching all checklist data with existing token...");
    const allData = await fetchAllChecklistData(accessToken);
    console.log("All data fetched successfully:");
    console.log(JSON.stringify(allData, null, 2));
    return allData;
  } catch (error) {
    console.error("Error in main execution:", error.message);
  }
}

main();
