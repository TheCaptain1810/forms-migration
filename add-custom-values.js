const axios = require("axios");
require("dotenv").config();

const createForm = require("./create-form").createForm;

const BASE_URL = process.env.BASE_URL;
const PROJECT_ID = process.env.PROJECT_ID;
const AUTH_TOKEN = `Bearer ${process.env.AUTH_TOKEN}`;

const updateData = {
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

async function updateFormValues() {
  try {
    const { formId } = await createForm();
    const response = await axios.put(
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
    console.log("Response:", response.data);
  } catch (error) {
    console.error("Error updating form values:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
}

updateFormValues();
