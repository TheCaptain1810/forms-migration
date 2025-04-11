const axios = require("axios");
require("dotenv").config();

const BASE_URL = process.env.BASE_URL;
const PROJECT_ID = process.env.PROJECT_ID;
const AUTH_TOKEN = `Bearer ${process.env.AUTH_TOKEN}`;

const formData = {
  assigneeId: "PUJXLNP3U8TM",
  assigneeType: "user",
  name: "Material Inspection Request #1",
  description: "For Sam Subcontractor",
  formDate: "2020-11-20",
  notes: "Installed 25 units",
};

// TODO: Change this data for respective MIR template
const updateData = {
  // check if there is some way to make this fieldId fetching dynamic as well
  customValues: [
    {
      fieldId: "79110a45-afcb-43dc-a3c3-2945a0ec4160",
      toggleVal: "Yes",
    },
    {
      fieldId: "bbceb11d-b9e2-48eb-b972-fb6a49504fdc",
      arrayVal: ["Answer 2", "Answer 3"],
    },
    {
      fieldId: "68d715fd-9eef-4ee5-b6ce-45c1cccc7347",
      choiceVal: "Answer 1",
    },
    {
      fieldId: "e313b84c-c812-4396-9659-a7ee7481f20b",
      textVal: "This is my response!",
    },
    {
      fieldId: "059fa8f6-8387-4dc3-8f33-9e1012e6adc4",
      numberVal: "2",
    },
  ],
};

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
        template.templateType === "Material Inspection Request" &&
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
