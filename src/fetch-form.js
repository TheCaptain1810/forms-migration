const request = require("request");
require("dotenv").config();

const companyId = "4266122";
const accessToken = process.env.PROCORE_ACCESS_TOKEN;

const options = {
  method: "GET",
  url: `https://api.procore.com/rest/v1.0/companies/${companyId}/checklist/alternative_response_sets`,
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Procore-Company-Id": companyId,
  },
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
