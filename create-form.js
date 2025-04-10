const axios = require("axios");
require("dotenv").config();

const fetchFormTemplateId = require("./get-templates").fetchFormTemplateId;

const BASE_URL = process.env.BASE_URL;
const PROJECT_ID = process.env.PROJECT_ID;
const AUTH_TOKEN = `Bearer ${process.env.AUTH_TOKEN}`;

const formData = {
  assigneeId: "PUJXLNP3U8TM",
  assigneeType: "user",
  name: "Daily Logs-10 April 2025",
  description: "For Sam Subcontractor",
  formDate: "2020-11-20",
  notes: "Installed 25 units",
};

async function createForm() {
  try {
    const TEMPLATE_ID = await fetchFormTemplateId();
    const response = await axios.post(
      `${BASE_URL}/projects/${PROJECT_ID}/form-templates/${TEMPLATE_ID}/forms`,
      formData,
      {
        headers: {
          Authorization: AUTH_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Form created successfully!");
    console.log("Response:", response.data);
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
