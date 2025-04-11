// Change this data according to the template you are using to create the form

const formData = {
  assigneeId: "PUJXLNP3U8TM",
  assigneeType: "user",
  name: "Daily Logs-12 April 2025",
  description: "For Sam Subcontractor",
  formDate: "2020-11-20",
  notes: "Installed 25 units",
};

const updateData = {
  // check if there is some way to make this fieldId fetching dynamic as well
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

module.exports = { formData, updateData };
