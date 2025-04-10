const express = require("express");
const { acc2LeggedAuth, getAcc3LeggedToken } = require("./auth");

const app = express();
const PORT = process.env.PORT || 5000;

app.get("/form-templates", async (req, res) => {
  try {
    const accessToken = await acc2LeggedAuth();
    const url = ` https://developer.api.autodesk.com/construction/forms/v1/projects/de199d13-ecfb-4b83-9b33-10d843b0d452/form-templates`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error fetching form templates: ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching form templates:", error.message);
    res.status(500).json({
      error: "Failed to fetch form templates",
      details: error.message,
    });
  }
});

app.get("/project-ids", async (req, res) => {
  try {
    const accessToken = await acc2LeggedAuth();
    const accountId = "47e894b9-4d04-44b9-8eb6-9564cbd3ade8";
    const url = `https://developer.api.autodesk.com/construction/admin/v1/accounts/${accountId}/projects?&limit=200`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error fetching projects: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log("Fetched project IDs:", data);
    const projectIds = data.results.map((project) => ({
      id: project.id,
      name: project.name,
    }));

    res.status(200).json(projectIds);
  } catch (error) {
    console.error("Error fetching project IDs:", error.message);
    res.status(500).json({
      error: "Failed to fetch project IDs",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
