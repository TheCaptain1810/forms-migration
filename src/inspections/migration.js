/**
 * Maps Procore section item IDs to ACC customValues field IDs based on matching names/itemLabels.
 * @param {Array} procoreData - Procore checklist/list_templates response
 * @param {Object} accData - ACC form template forms response
 * @returns {Object} Mapping of Procore item IDs to ACC field IDs
 */
function mapProcoreAccIds(procoreData, accData) {
  // Initialize the mapping object
  const idMapping = {};

  // Extract customValues from ACC data
  const accCustomValues = accData.customValues || [];

  // Create a lookup object for ACC customValues by itemLabel
  const accLookup = {};
  accCustomValues.forEach((cv) => {
    accLookup[cv.itemLabel] = cv.fieldId;
  });

  // Iterate through Procore templates
  for (const template of procoreData) {
    if (template.name === accData.formTemplate.name) {
      // Match template name
      // Iterate through sections
      for (const section of template.sections || []) {
        // Iterate through items in each section
        for (const item of section.items || []) {
          const procoreItemName = item.name;
          const procoreItemId = item.id;

          // Check if Procore item name exists in ACC lookup
          if (procoreItemName in accLookup) {
            const accFieldId = accLookup[procoreItemName];
            idMapping[procoreItemId] = accFieldId;
          }
        }
      }
    }
  }

  return idMapping;
}

// Example usage
function main() {
  // Sample data (in practice, load from API responses or files)
  const procoreData = [
    {
      id: 2756551,
      name: "Material Inspection Request",
      sections: [
        {
          id: 12794844,
          name: "Supporting Documents",
          items: [
            { id: 72764072, name: "Material Approval" },
            { id: 72764073, name: "Packing List" },
            // ... other items
          ],
        },
        // ... other sections
      ],
    },
    // ... other templates
  ];

  const accData = {
    formTemplate: {
      name: "Material Inspection Request",
    },
    customValues: [
      {
        fieldId: "1e1c49f8-c947-4252-8375-989764bbecfc",
        itemLabel: "Material Approval",
      },
      {
        fieldId: "c2813207-1753-4230-9430-ff0b369abcae",
        itemLabel: "Packing List",
      },
      // ... other custom values
    ],
  };

  // Get the mapping
  const mapping = mapProcoreAccIds(procoreData, accData);

  // Print results
  console.log("Procore Item ID to ACC Field ID Mapping:");
  for (const [procoreId, accId] of Object.entries(mapping)) {
    console.log(`Procore ID: ${procoreId} -> ACC Field ID: ${accId}`);
  }
}

// Run the script
main();
