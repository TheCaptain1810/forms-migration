const axios = require("axios");
const dotenv = require("dotenv");
const exec = require("child_process").exec;

dotenv.config();

const { ACC_SANDBOX_CLIENT_ID, ACC_SANDBOX_CLIENT_SECRET, ACC_REDIRECT_URI } =
  process.env;

const ACC_AUTH_URL =
  "https://developer.api.autodesk.com/authentication/v2/authorize";
const ACC_TOKEN_URL =
  "https://developer.api.autodesk.com/authentication/v2/token";
const ACC_USER_INFO_URL = "https://api.userprofile.autodesk.com/userinfo";

const accAuthUrl = () => {
  try {
    const scopes = encodeURIComponent(
      "data:read data:write data:create account:read account:write"
    );
    const url = `${ACC_AUTH_URL}?response_type=code&client_id=${ACC_SANDBOX_CLIENT_ID}&redirect_uri=${ACC_REDIRECT_URI}&scope=${scopes}`;

    let openCommand = "";
    if (process.platform === "win32") {
      openCommand = `start "" "${url}"`;
    } else if (process.platform === "darwin") {
      openCommand = `open "${url}"`;
    } else {
      openCommand = `xdg-open "${url}"`;
    }

    exec(openCommand, (err) => {
      if (err) {
        console.error("❌ Failed to open browser:", err);
      } else {
        console.log(
          "✅ Browser opened and ACC authentication flow executed successfully"
        );
      }
    });

    return url;
  } catch (error) {
    console.error("❌ Failed to start authentication:", error.message);
    return "";
  }
};

/**
 * Fetches a fresh 2-legged token from Autodesk API.
 */
const acc2LeggedAuth = async () => {
  try {
    const payload = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "account:read account:write data:read data:write data:create",
    });

    const base64Auth = Buffer.from(
      `${ACC_SANDBOX_CLIENT_ID}:${ACC_SANDBOX_CLIENT_SECRET}`
    ).toString("base64");

    const { data } = await axios.post(ACC_TOKEN_URL, payload.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${base64Auth}`,
      },
    });
    console.log("✅ New ACC 2-legged token obtained successfully");
    return data.access_token;
  } catch (error) {
    console.error(
      "❌ Error fetching ACC 2-legged token:",
      error.response?.data || error.message
    );
    throw new Error("Failed to get ACC 2-legged token");
  }
};

// Exchange auth code for access token
const getAcc3LeggedToken = async (code) => {
  if (
    !ACC_SANDBOX_CLIENT_ID ||
    !ACC_SANDBOX_CLIENT_SECRET ||
    !ACC_REDIRECT_URI
  ) {
    throw new Error(
      "Missing required environment variables for authentication."
    );
  }

  const payload = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: ACC_SANDBOX_CLIENT_ID,
    client_secret: ACC_SANDBOX_CLIENT_SECRET,
    redirect_uri: ACC_REDIRECT_URI,
    code,
  });

  const { data } = await axios.post(ACC_TOKEN_URL, payload.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  console.log(data);

  return data;
};

// Get user info from Autodesk API
const accUserInfo = async (accessToken) => {
  const { data } = await axios.get(ACC_USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
};

// Refresh expired token
const accRefreshToken = async (refreshToken) => {
  if (
    !ACC_SANDBOX_CLIENT_ID ||
    !ACC_SANDBOX_CLIENT_SECRET ||
    !ACC_REDIRECT_URI
  ) {
    throw new Error(
      "Missing required environment variables for authentication."
    );
  }
  const payload = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ACC_SANDBOX_CLIENT_ID,
    client_secret: ACC_SANDBOX_CLIENT_SECRET,
    refresh_token: refreshToken,
    scope: "account:read account:write data:read data:write data:create",
  });
  const { data } = await axios.post(ACC_TOKEN_URL, payload.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return data;
};

module.exports = {
  accAuthUrl,
  getAcc3LeggedToken,
  acc2LeggedAuth,
  accUserInfo,
  accRefreshToken,
};
