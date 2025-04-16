const request = require("request");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const companyId = "4266122";
const projectId = "121313";
const accessToken = process.env.PROCORE_ACCESS_TOKEN;
const refreshToken = process.env.PROCORE_REFRESH_TOKEN;
// Use the sandbox credentials since we're using the sandbox
const clientId = process.env.PROCORE_SANBOX_CLIENT_ID;
const clientSecret = process.env.PROCORE_SANDBOX_CLIENT_SECRET;
const procore_base_url = process.env.PROCORE_SANDBOX_BASE_URL;

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

function fetchChecklistComments(token) {
  const options = {
    method: "GET",
    url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_item_comments`,
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

function fetchRecycledChecklistComments(token) {
  const options = {
    method: "GET",
    url: `${procore_base_url}/rest/v1.0/projects/${projectId}/recycle-bin/checklist/list_item_comments`,
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

function fetchDefaultDistributionMembers(token) {
  const options = {
    method: "GET",
    url: `${procore_base_url}/rest/v1.0/checklist/default_distribution`,
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

function fetchChecklistItemAttachments(token) {
  const options = {
    method: "GET",
    url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_item_attachments`,
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

function fetchChecklistItemObservations(token) {
  const options = {
    method: "GET",
    url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_item_observations`,
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

function fetchChecklistItemTypes(token) {
  const options = {
    method: "GET",
    url: `${procore_base_url}/rest/v1.0/checklist/item_types`,
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

function fetchChecklistItems(token) {
  const options = {
    method: "GET",
    url: `${procore_base_url}/rest/v1.0/projects/${projectId}/checklist/list_items`,
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

console.log("Attempting to fetch data with existing token...");
fetchChecklistData(accessToken);
fetchChecklistComments(accessToken);
fetchRecycledChecklistComments(accessToken);
fetchDefaultDistributionMembers(accessToken);
fetchChecklistItemAttachments(accessToken);
fetchChecklistItemObservations(accessToken);
fetchChecklistItemTypes(accessToken);
fetchChecklistItems(accessToken);
