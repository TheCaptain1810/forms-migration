const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const baseUrl = process.env.ACC_BASE_URL;
const projectId = process.env.ACC_PROJECT_ID;
const authToken = `Bearer ${process.env.ACC_AUTH_TOKEN}`;

class AccFormCreator {
  constructor() {
    this.dataDir = path.resolve(__dirname, "./data/generated");
    this.formDataFile = path.join(this.dataDir, "acc-form-data.json");
  }

  async createForm(formEntry) {
    const { templateName, formData, updateData } = formEntry;

    try {
      // Fetch templates
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
        (t) => t.name === templateName && t.status === "active"
      );

      if (!template) {
        throw new Error(`Template "${templateName}" not found or not active`);
      }

      console.log("Template ID:", template.id);
      console.log("Template Name:", template.name);

      // Create form
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
      console.log(formData);

      const formId = createFormResponse.data.id;
      const customFieldIds = createFormResponse.data.customValues.map(
        (field) => field.fieldId
      );

      console.log("Form ID:", formId);
      console.log("Custom Field IDs:", customFieldIds);

      // Update custom values
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

      console.log(`Form "${formData.name}" values updated successfully!`);
      console.log(addCustomValuesResponse.data);
      return { formId, status: "success" };
    } catch (error) {
      console.error(`Error creating form "${formData.name}":`);
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
      } else {
        console.error("Error:", error.message);
      }
      return { formId: null, status: "failed", error: error.message };
    }
  }

  async run() {
    try {
      // Read transformed form data
      if (!fs.existsSync(this.formDataFile)) {
        throw new Error(
          "ACC form data file not found. Run Procore fetch first."
        );
      }

      const accFormData = JSON.parse(
        fs.readFileSync(this.formDataFile, "utf-8")
      );

      if (!accFormData || accFormData.length === 0) {
        console.log("No forms to create.");
        return;
      }

      console.log(`Processing ${accFormData.length} forms...`);

      const results = [];
      for (const formEntry of accFormData) {
        const result = await this.createForm(formEntry);
        results.push(result);
      }

      // Summarize results
      const successes = results.filter((r) => r.status === "success").length;
      const failures = results.filter((r) => r.status === "failed").length;

      console.log("\n=== FORM CREATION SUMMARY ===");
      console.log(`Total forms: ${accFormData.length}`);
      console.log(`Successful: ${successes}`);
      console.log(`Failed: ${failures}`);

      if (failures > 0) {
        console.log("Failed forms:");
        results
          .filter((r) => r.status === "failed")
          .forEach((r) => console.log(`- ${r.error}`));
      }
    } catch (error) {
      console.error("Fatal error in ACC form creation:", error.message);
    }
  }
}

const creator = new AccFormCreator();
creator.run();
