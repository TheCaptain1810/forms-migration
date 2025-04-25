const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const baseUrl = process.env.ACC_BASE_URL || "https://developer.api.autodesk.com/construction/admin/v1";
const projectId = process.env.ACC_PROJECT_ID;
const authToken = process.env.ACC_AUTH_TOKEN 
  ? `Bearer ${process.env.ACC_AUTH_TOKEN}`
  : null;

// Daily Log form template - this must match a template name in ACC
const DAILY_LOG_TEMPLATE = "Daily Logs";

// Define common field IDs for daily logs
// These will be populated when creating forms if custom fields are provided in the template
const FIELD_IDS = {
  // You can hard-code known field IDs here if needed
  // Example: WEATHER_CONDITIONS: "your-actual-field-id"
};

class AccDailyLogFormCreator {
  constructor() {
    this.dataDir = path.resolve(__dirname, "./data/generated");
    this.dailyLogDataFile = path.join(this.dataDir, "acc-dailylog-data.json");
    this.outputFile = path.join(this.dataDir, "dailylog-forms-results.json");
  }

  async createForm(dailyLog) {
    try {
      // Simple validation of required fields
      if (!dailyLog.date || !dailyLog.createdBy) {
        throw new Error("Daily log missing required fields (date or createdBy)");
      }

      // Fetch templates to find the daily log template
      const getTemplatesResponse = await axios.get(
        `${baseUrl}/projects/${projectId}/form-templates`,
        {
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
          params: {
            limit: 50,
            offset: 0,
          },
        }
      );

      const templates = getTemplatesResponse.data;
      const template = templates.data.find(
        (t) => t.name === DAILY_LOG_TEMPLATE && t.status === "active"
      );

      if (!template) {
        throw new Error(`Template "${DAILY_LOG_TEMPLATE}" not found or not active. Available templates: ${templates.data.map(t => t.name).join(", ")}`);
      }

      console.log(`Using template: ${template.name} (ID: ${template.id})`);

      // Prepare form data
      const formData = {
        assigneeId: dailyLog.createdBy,
        assigneeType: "user",
        name: dailyLog.title,
        description: dailyLog.summary || "Daily log report",
        formDate: dailyLog.date,
        notes: `Weather: ${dailyLog.weather.conditions}, Temp: ${dailyLog.weather.temperature}, Precipitation: ${dailyLog.weather.precipitation}`,
      };

      // Create the form
      const createFormResponse = await axios.post(
        `${baseUrl}/projects/${projectId}/form-templates/${template.id}/forms`,
        formData,
        {
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Form "${formData.name}" created successfully!`);
      const formId = createFormResponse.data.id;
      
      // Use custom field IDs if provided in the response
      // This avoids the need to call template details API
      let customFields = [];
      if (createFormResponse.data.customValues && createFormResponse.data.customValues.length > 0) {
        console.log(`Found ${createFormResponse.data.customValues.length} custom fields in form template`);
        
        // Map available fields by type
        const availableFields = {};
        createFormResponse.data.customValues.forEach(field => {
          const fieldName = field.definition?.name?.toLowerCase() || '';
          
          // Categorize fields based on their names
          if (fieldName.includes('weather') || fieldName.includes('condition')) {
            availableFields.weatherConditions = field.fieldId;
          } else if (fieldName.includes('temp') || fieldName.includes('temperature')) {
            availableFields.temperature = field.fieldId;
          } else if (fieldName.includes('precip') || fieldName.includes('rain')) {
            availableFields.precipitation = field.fieldId;
          } else if (fieldName.includes('manpower') || fieldName.includes('labor') || fieldName.includes('crew')) {
            availableFields.manpower = field.fieldId;
          } else if (fieldName.includes('note') || fieldName.includes('comment')) {
            availableFields.notes = field.fieldId;
          }
        });
        
        console.log("Mapped fields:", JSON.stringify(availableFields, null, 2));
        
        // Create custom values based on available fields
        const customValues = [];
        
        // Add weather data to custom values if field IDs exist
        if (availableFields.weatherConditions) {
          customValues.push({
            fieldId: availableFields.weatherConditions,
            textVal: dailyLog.weather.conditions
          });
        }
        
        if (availableFields.temperature) {
          customValues.push({
            fieldId: availableFields.temperature,
            textVal: dailyLog.weather.temperature
          });
        }
        
        if (availableFields.precipitation) {
          customValues.push({
            fieldId: availableFields.precipitation,
            textVal: dailyLog.weather.precipitation
          });
        }
        
        // Add manpower data
        if (availableFields.manpower && dailyLog.manpower && dailyLog.manpower.length > 0) {
          // Format manpower data for a text field
          const manpowerText = dailyLog.manpower.map(mp => 
            `Company: ${mp.company}, Workers: ${mp.numberOfWorkers}, Hours: ${mp.hours}, Notes: ${mp.description}`
          ).join("\n");
          
          customValues.push({
            fieldId: availableFields.manpower,
            textVal: manpowerText
          });
        }
        
        // Add any additional notes
        if (availableFields.notes && dailyLog.summary) {
          customValues.push({
            fieldId: availableFields.notes,
            textVal: dailyLog.summary
          });
        }

        // Only update custom values if we have any
        if (customValues.length > 0) {
          const updateData = { customValues };
          
          const addCustomValuesResponse = await axios.put(
            `${baseUrl}/projects/${projectId}/forms/${formId}/values:batch-update`,
            updateData,
            {
              headers: {
                Authorization: authToken,
                "Content-Type": "application/json",
              },
            }
          );

          console.log(`Form "${formData.name}" values updated successfully with ${customValues.length} custom fields!`);
        } else {
          console.log(`No matching custom fields found for form "${formData.name}". Basic form created.`);
        }
      } else {
        console.log(`No custom fields found in form template. Creating basic form.`);
      }

      return { 
        formId, 
        status: "success",
        date: dailyLog.date,
        title: dailyLog.title
      };
    } catch (error) {
      console.error(`Error creating form for daily log on ${dailyLog.date}:`);
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", JSON.stringify(error.response.data, null, 2));
      } else {
        console.error("Error:", error.message);
      }
      return { 
        formId: null, 
        status: "failed", 
        error: error.message, 
        date: dailyLog.date,
        title: dailyLog.title || "Unknown"
      };
    }
  }

  async run() {
    try {
      // Validate auth token
      if (!authToken) {
        throw new Error("ACC_AUTH_TOKEN is missing in .env file");
      }

      // Read transformed daily log data
      if (!fs.existsSync(this.dailyLogDataFile)) {
        throw new Error(
          "Daily log data file not found. Run fetch-dailylogs.js first."
        );
      }

      const dailyLogs = JSON.parse(
        fs.readFileSync(this.dailyLogDataFile, "utf-8")
      );

      if (!dailyLogs || dailyLogs.length === 0) {
        console.log("No daily logs to create forms for.");
        return;
      }

      console.log(`Processing ${dailyLogs.length} daily logs...`);

      const results = [];
      for (const dailyLog of dailyLogs) {
        const result = await this.createForm(dailyLog);
        results.push(result);
      }

      // Save results to file
      fs.writeFileSync(this.outputFile, JSON.stringify(results, null, 2));

      // Summarize results
      const successes = results.filter((r) => r.status === "success").length;
      const failures = results.filter((r) => r.status === "failed").length;

      console.log("\n=== DAILY LOG FORM CREATION SUMMARY ===");
      console.log(`Total forms: ${dailyLogs.length}`);
      console.log(`Successful: ${successes}`);
      console.log(`Failed: ${failures}`);

      if (failures > 0) {
        console.log("\nFailed forms:");
        results
          .filter((r) => r.status === "failed")
          .forEach((r) => console.log(`- ${r.date} (${r.title}): ${r.error}`));
      }

      console.log("\nForm creation process complete.");
      console.log(`Results saved to ${this.outputFile}`);
    } catch (error) {
      console.error("Fatal error in ACC daily log form creation:", error.message);
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const creator = new AccDailyLogFormCreator();
  creator.run();
}

// Export for potential use in other modules
module.exports = AccDailyLogFormCreator; 