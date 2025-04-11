const axios = require("axios");
require("dotenv").config();

const { formData, updateData } = require("../data");

const BASE_URL = process.env.BASE_URL;
const PROJECT_ID = process.env.PROJECT_ID;
const AUTH_TOKEN = `Bearer ${process.env.AUTH_TOKEN}`;

async function createForm() {
  try {
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

    const dailyLogTemplateId = templates.data.filter(
      (template) =>
        template.templateType === "Work Inspection Request" &&
        template.status === "active"
    )[0].id;

    console.log("Template ID", dailyLogTemplateId);

    const createFormResponse = await axios.post(
      `${BASE_URL}/projects/${PROJECT_ID}/form-templates/${dailyLogTemplateId}/forms`,
      formData,
      {
        headers: {
          Authorization: AUTH_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Form created successfully!");

    const formId = createFormResponse.data.id;
    const customFieldIds = createFormResponse.data.customValues.map(
      (field) => field.fieldId
    );

    console.log("Form ID:", formId);
    console.log("Custom Field IDs:", customFieldIds);

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

    console.log("Form values updated successfully!");
    // console.log("Response:", addCustomValuesResponse.data);
  } catch (error) {
    console.error("Error creating form:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
}

createForm();
