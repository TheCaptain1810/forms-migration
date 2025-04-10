const axios = require("axios");
require("dotenv").config();

const BASE_URL = process.env.BASE_URL;
const PROJECT_ID = process.env.PROJECT_ID;
const AUTH_TOKEN = `Bearer ${process.env.AUTH_TOKEN}`;

async function fetchFormTemplateId() {
  try {
    const response = await axios.get(
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

    const templates = response.data;

    const dailyLogTemplateId = templates.data.filter(
      (template) =>
        template.templateType === "pg.template_type.daily_report" &&
        template.status === "active"
    )[0].id;

    console.log("ID", dailyLogTemplateId);

    return dailyLogTemplateId;
  } catch (error) {
    console.error("Error fetching form templates:");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }

    throw error;
  }
}

// fetchFormTemplateId();

module.exports = { fetchFormTemplateId };
