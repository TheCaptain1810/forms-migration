const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const BASE_URL = process.env.BASE_URL;
const PROJECT_ID = process.env.PROJECT_ID;
const AUTH_TOKEN = `Bearer ${process.env.AUTH_TOKEN}`;

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
        `${BASE_URL}/projects/${PROJECT_ID}/form-templates`,
        {
          headers: {
            Authorization: AUTH_TOKEN,
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
        `${BASE_URL}/projects/${PROJECT_ID}/form-templates/${template.id}/forms`,
        formData,
        {
          headers: {
            Authorization: AUTH_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Form "${formData.name}" created successfully!`);

      const formId = createFormResponse.data.id;
      const customFieldIds = createFormResponse.data.customValues.map(
        (field) => field.fieldId
      );

      console.log("Form ID:", formId);
      console.log("Custom Field IDs:", customFieldIds);

      // Update custom values
      const addCustomValuesResponse = await axios.put(
        `${BASE_URL}/projects/${PROJECT_ID}/forms/${formId}/values:batch-update`,
        updateData,
        {
          headers: {
            Authorization: AUTH_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Form "${formData.name}" values updated successfully!`);
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
