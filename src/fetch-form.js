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
      subcategory: endpoint.subcategory || null,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      name: endpoint.name,
      category: endpoint.category,
      subcategory: endpoint.subcategory || null,
      error: error.message,
      status: error.response?.status || 'unknown'
    };
  }
}

async function fetchDependentData(token, baseData) {
  const dependentRequests = [];

  // SCHEDULE RELATED ENDPOINTS
  if (baseData.project && baseData.project.schedules && baseData.project.schedules.data) {
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
  if (baseData.project && baseData.project.lists && baseData.project.lists.data) {
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
  if (baseData.company && baseData.company.inspectionTemplates && baseData.company.inspectionTemplates.data) {
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
  if (baseData.company && baseData.company.listTemplates && baseData.company.listTemplates.data) {
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
  if (baseData.project && baseData.project.inspectionItems && baseData.project.inspectionItems.data) {
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
  if (baseData.project && baseData.project.inspectionTemplateItems && baseData.project.inspectionTemplateItems.data) {
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
  if (baseData.project && baseData.project.inspections && baseData.project.inspections.data) {
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
  if (baseData.company && baseData.company.responseSets && baseData.company.responseSets.data) {
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
  if (baseData.project && baseData.project.projectInspectionTemplates && baseData.project.projectInspectionTemplates.data) {
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

  // Make all dependent requests
  if (dependentRequests.length > 0) {
    console.log(`Making ${dependentRequests.length} dependent requests...`);
    const requests = dependentRequests.map(endpoint => makeApiRequest(token, endpoint));
    return await Promise.all(requests);
  }
  
  return [];
}

async function fetchAllChecklistData(token) {
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
    // "inspectionItems" would be here if it existed in API
    // "inspectionTemplateItems" would be here if it existed in API
    // "inspections" would be here if it existed in API
    // "projectInspectionTemplates" would be here if it existed in API
    
    // Recycled bin endpoints
    {
      name: "recycledListItemComments",
      category: "recycled",
      url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle-bin/checklist/list_item_comments`,
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
    
    // General checklist endpoints
    {
      name: "listTemplates",
      category: "checklist",
      url: `${procore_base_url}/rest/v1.0/checklist/list_templates`,
    },
    {
      name: "possibleInspectors",
      category: "checklist",
      url: `${procore_base_url}/rest/v1.0/checklist/possible_inspectors`,
    },
    {
      name: "potentialPointsOfContact",
      category: "checklist",
      url: `${procore_base_url}/rest/v1.0/checklist/potential_points_of_contact`,
    }
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
        if (!baseData.dependent[result.subcategory]) {
          baseData.dependent[result.subcategory] = {};
        }
        
        baseData.dependent[result.subcategory][result.name] = {
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

// Helper function to generate a summary of the response
function generateResponseSummary(data) {
  const summary = {
    categories: {},
    totalEndpoints: 0,
    successfulEndpoints: 0,
    failedEndpoints: 0
  };
  
  // Process each category
  for (const category in data) {
    summary.categories[category] = {
      endpoints: Object.keys(data[category]).length,
      successful: 0,
      failed: 0
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
    console.log("Fetching all checklist data with existing token...");
    const allData = await fetchAllChecklistData(accessToken);
    
    // Generate a summary
    const summary = generateResponseSummary(allData);
    
    console.log("All data fetched successfully:");
    console.log("=== SUMMARY ===");
    console.log(`Total endpoints: ${summary.totalEndpoints}`);
    console.log(`Successful: ${summary.successfulEndpoints}`);
    console.log(`Failed: ${summary.failedEndpoints}`);
    console.log("Categories:");
    for (const category in summary.categories) {
      console.log(`- ${category}: ${summary.categories[category].successful} successful, ${summary.categories[category].failed} failed`);
    }
    
    // Log the full response data
    console.log("=== FULL RESPONSE ===");
    console.log(JSON.stringify(allData, null, 2));
    
    return allData;
  } catch (error) {
    console.error("Error in main execution:", error.message);
  }
}

main();
