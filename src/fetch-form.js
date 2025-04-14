const sdk = require("@procore/js-sdk");
const axios = require("axios");
require("dotenv").config();

// Procore API credentials
const accessToken = process.env.PROCORE_ACCESS_TOKEN;
// const clientId = process.env.PROCORE_SANDBOX_CLIENT_ID;
// const clientSecret = process.env.PROCORE_SANDBOX_CLIENT_SECRET;
// const redirectUri = process.env.PROCORE_REDIRECT_URI;
const companyId = "YOUR_COMPANY_ID";
const projectId = "YOUR_PROJECT_ID";
const logDate = "2025-04-14";

// const tokenUrl = `${process.env.PROCORE_SANDBOX_BASE_URL}/oauth/token`;

// async function getAccessToken() {
//   try {
//     const response = await axios.post(tokenUrl, {
//       grant_type: "client_credentials",
//       client_id: clientId,
//       client_secret: clientSecret,
//       redirect_uri: redirectUri,
//     });
//     return response.data.access_token;
//   } catch (error) {
//     console.error(
//       "Error fetching access token:",
//       error.response ? error.response.data : error.message
//     );
//     throw error;
//   }
// }

async function fetchDailyLogs() {
  try {
    const authorizer = {
      accessToken: () => accessToken,
      get: () => ({ access_token: accessToken }),
    };
    const client = sdk.client(authorizer);

    const response = await client.get(
      {
        base: `/vapid/projects/${projectId}/daily_logs`,
        qs: {
          company_id: companyId,
          log_date: logDate,
        },
      },
      { companyId }
    );

    const { body } = response;
    if (body && body.length > 0) {
      console.log("Daily Logs:", body);
    } else {
      console.log("No logs found for the specified date.");
    }
  } catch (error) {
    console.error(
      "Error fetching daily logs:",
      error.response ? error.response.data : error.message
    );
  }
}

fetchDailyLogs();
