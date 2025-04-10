const axios = require("axios");

const baseUrl = "https://developer.api.autodesk.com/construction/forms/v1";
const projectId = "de199d13-ecfb-4b83-9b33-10d843b0d452";
const formId = "ffeacd5b-6958-4cfa-8f8c-89a48040ee11";
const authToken =
  "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IlhrUFpfSmhoXzlTYzNZS01oRERBZFBWeFowOF9SUzI1NiIsInBpLmF0bSI6ImFzc2MifQ.eyJzY29wZSI6WyJkYXRhOnJlYWQiLCJkYXRhOndyaXRlIiwiZGF0YTpjcmVhdGUiLCJhY2NvdW50OnJlYWQiLCJhY2NvdW50OndyaXRlIl0sImNsaWVudF9pZCI6IjZURXUwMjVzY1RKdXNJUjR5cVZTUE5HYkpVMVZha0JOQ21Db1h1eVhSaG9ydm5EUSIsImlzcyI6Imh0dHBzOi8vZGV2ZWxvcGVyLmFwaS5hdXRvZGVzay5jb20iLCJhdWQiOiJodHRwczovL2F1dG9kZXNrLmNvbSIsImp0aSI6IlNGMmJNbDVSNUNLVXFBZzJOZTVDU0xzRGlKUDN0ZHBxWmlkVzhPaXc4eXdOamZBRkZYOGVTQjZRcWlqSnNnSWQiLCJleHAiOjE3NDQxODE0MDEsInVzZXJpZCI6IlBVSlhMTlAzVThUTSJ9.PGw1vwv7FJcen1y76lw4c2K7V684fjemSjtsmPGfYbBS8C0eGvpauKOrPTn3T-K8LxVV3XFjgunqIcxAKB7iv78VcOc8aYZUAJFhptGH1M9iuqNiACcQWQdZag4tQT5kK0C0eirph_Rh_F87VrMkJXQ5d_Kevqf4W0ZzsF4zwsIY8PjlaxOMz0I6YzfWztwVlD-peI2peSZ2GuFAjndKhTEnX0knTfxHBpqQ_lQM3gADtgTDqZhbwH5Mn86FQYcCdqz3g3r-Yui4npMW8N2CLtQdef296-4TYmUMj_orFwl3zO0wMPtAyAkB7vzwItIhLWlTm4Fu2BuQ0buH0p6N6A";

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
    const response = await axios.put(
      `${baseUrl}/projects/${projectId}/forms/${formId}/values:batch-update`,
      updateData,
      {
        headers: {
          Authorization: authToken,
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
