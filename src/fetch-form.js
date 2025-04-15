const request = require("request");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Debug original values
console.log(
  "Loading environment variables from:",
  path.resolve(__dirname, "../.env")
);

const companyId = "4266122";
const accessToken = process.env.PROCORE_ACCESS_TOKEN;
const refreshToken = process.env.PROCORE_REFRESH_TOKEN;
// Use the sandbox credentials since we're using the sandbox
const clientId = process.env.PROCORE_SANBOX_CLIENT_ID;
const clientSecret = process.env.PROCORE_SANDBOX_CLIENT_SECRET;
const procore_base_url =
  process.env.PROCORE_SANDBOX_BASE_URL || "https://sandbox.procore.com";

// Debug logs
console.log("Refresh Token defined:", !!refreshToken);
console.log("Client ID defined:", !!clientId);
console.log("Client Secret defined:", !!clientSecret);

/**
 * Your refresh token has expired or is invalid. To get a new refresh token:
 *
 * 1. Visit: ${procore_base_url}/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${process.env.PROCORE_REDIRECT_URI}
 * 2. After authorization, you'll be redirected to your callback URL with a code
 * 3. Use that code to get a new token with:
 *    curl -X POST "${procore_base_url}/oauth/token" \
 *      -d "grant_type=authorization_code" \
 *      -d "client_id=${clientId}" \
 *      -d "client_secret=${clientSecret}" \
 *      -d "code=YOUR_CODE" \
 *      -d "redirect_uri=${process.env.PROCORE_REDIRECT_URI}"
 */

function refreshAccessToken() {
  return new Promise((resolve, reject) => {
    const formData = {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    };

    console.log("Sending refresh token request with data:", formData);

    const refreshOptions = {
      method: "POST",
      url: `${procore_base_url}/oauth/token`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      form: formData,
    };

    request(refreshOptions, function (error, response, body) {
      if (error) return reject(error);

      try {
        const tokenData = JSON.parse(body);
        if (tokenData.access_token) {
          console.log("Token refreshed successfully");
          resolve(tokenData.access_token);
        } else {
          reject(new Error("Failed to refresh token: " + body));
        }
      } catch (e) {
        reject(
          new Error("Failed to parse refresh token response: " + e.message)
        );
      }
    });
  });
}

function fetchChecklistData(token) {
  const options = {
    method: "GET",
    url: `${procore_base_url}/rest/v1.0/companies/${companyId}/checklist/alternative_response_sets`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Procore-Company-Id": companyId,
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    if (response.statusCode === 401) {
      console.log("Token expired, refreshing...");
      refreshAccessToken()
        .then((newToken) => fetchChecklistData(newToken))
        .catch((err) => console.error("Error refreshing token:", err));
    } else {
      console.log(body);
    }
  });
}

// Helper function to print authorization URL
function printAuthInstructions() {
  const authUrl = `${procore_base_url}/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${process.env.PROCORE_REDIRECT_URI}`;
  console.log(
    "\nYour refresh token has expired or is invalid. To get a new one:"
  );
  console.log(`1. Visit this URL in your browser:\n   ${authUrl}`);
  console.log(
    "2. After authorization, you'll be redirected with a code parameter"
  );
  console.log("3. Use that code to get a new token with this command:");
  console.log(`   curl -X POST "${procore_base_url}/oauth/token" \\
     -d "grant_type=authorization_code" \\
     -d "client_id=${clientId}" \\
     -d "client_secret=${clientSecret}" \\
     -d "code=YOUR_CODE" \\
     -d "redirect_uri=${process.env.PROCORE_REDIRECT_URI}"`);
  console.log(
    "4. Update your .env file with the new access_token and refresh_token"
  );
}

// Start the process with the current token
console.log("Attempting to fetch data with existing token...");
fetchChecklistData(accessToken);

// Also print auth instructions since we know the token is likely expired
printAuthInstructions();
