const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const baseUrl = process.env.ACC_BASE_URL;
const projectId = process.env.ACC_PROJECT_ID;
const authToken = `Bearer ${process.env.ACC_AUTH_TOKEN}`;
const issueStatus = process.env.ACC_ISSUE_STATUS || "open";
const issueTypeId =
  process.env.ACC_ISSUE_TYPE_ID || "64d1071e-e071-498c-a9f1-2af27f7b206f";
const issueSubtypeId =
  process.env.ACC_ISSUE_SUBTYPE_ID || "c4965ffe-3812-4f0f-b41a-4a94dbdab1bb";

class AccIssueCreator {
  constructor() {
    this.dataDir = path.resolve(__dirname, "./data/generated");
    this.inputFile = path.join(this.dataDir, "observations.json");
  }

  async createIssue(formEntry) {
    const { formData, updateData } = formEntry;

    try {
      // Build issue payload based on ACC format
      const issuePayload = {
        title: formData.name,
        description: formData.description || "",
        status: issueStatus,
        issueTypeId: issueTypeId,
        issueSubtypeId: issueSubtypeId,
        dueDate: formData.dueDate || null,
        startDate: formData.startDate || null,
        locationDetails: formData.location || null,
        published: false, // Default to unpublished
        customAttributes: updateData.customAttributes || [],
      };

      // Add assignee if available
      if (formData.assigneeId) {
        issuePayload.assignedTo = formData.assigneeId;
        issuePayload.assignedToType = formData.assigneeType || "user";
      }

      // Create issue
      const response = await axios.post(
        `${baseUrl}/projects/${projectId}/issues`,
        issuePayload,
        {
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(
        `Issue "${formData.name}" created with ID: ${response.data.id}`
      );
      return { issueId: response.data.id, status: "success" };
    } catch (error) {
      console.error(`Error creating issue "${formData.name}":`);
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
      } else {
        console.error("Error:", error.message);
      }
      return { issueId: null, status: "failed", error: error.message };
    }
  }

  transformObservation(obs) {
    // Transform Procore observation to ACC issue format
    const entry = {
      formData: {
        name: `${obs.number || ""}: ${obs.name || "Untitled"}`.trim(),
        description: obs.description || "",
        assigneeId: obs.assignee?.id || null,
        assigneeType: "user",
        dueDate: obs.due_date || null,
        startDate: obs.start_date || null,
        location: obs.location || null,
      },
      updateData: {
        customAttributes: [],
      },
    };

    // Add custom attributes if available
    if (obs.custom_fields && Array.isArray(obs.custom_fields)) {
      entry.updateData.customAttributes = obs.custom_fields.map((field) => ({
        attributeDefinitionId: field.custom_field_definition_id,
        value: field.value,
        type: field.type || "text",
        title: field.title || "",
      }));
    }

    return entry;
  }

  async run() {
    try {
      // Read transformed data
      if (!fs.existsSync(this.inputFile)) {
        throw new Error(
          "Input data file not found (observations.json). Run Procore fetch first."
        );
      }

      // Load Procore observations from raw data
      const rawData = JSON.parse(fs.readFileSync(this.inputFile, "utf-8"));
      const observations = rawData.project?.observations?.data || [];

      if (observations.length === 0) {
        console.log("No observations to create issues from.");
        return;
      }

      console.log(
        `Processing ${observations.length} observations into issues...`
      );

      const results = [];
      for (const obs of observations) {
        // Transform each observation into issue payload
        const entry = this.transformObservation(obs);
        const result = await this.createIssue(entry);
        results.push(result);
      }

      // Summarize results
      const successes = results.filter((r) => r.status === "success").length;
      const failures = results.filter((r) => r.status === "failed").length;

      console.log("\n=== ISSUE CREATION SUMMARY ===");
      console.log(`Total issues: ${observations.length}`);
      console.log(`Successful: ${successes}`);
      console.log(`Failed: ${failures}`);

      if (failures > 0) {
        console.log("Failed issues:");
        results
          .filter((r) => r.status === "failed")
          .forEach((r) => console.log(`- ${r.error}`));
      }
    } catch (error) {
      console.error("Fatal error in ACC issue creation:", error.message);
    }
  }
}

const creator = new AccIssueCreator();
creator.run();
