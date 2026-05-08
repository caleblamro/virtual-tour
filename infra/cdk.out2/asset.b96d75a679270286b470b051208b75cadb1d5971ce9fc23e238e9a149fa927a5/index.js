"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// asset-input/src/getJob.ts
var getJob_exports = {};
__export(getJob_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(getJob_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
var JOBS_TABLE = process.env.JOBS_TABLE;
var CLOUDFRONT_OUTPUT_URL = process.env.CLOUDFRONT_OUTPUT_URL;
var handler = async (event) => {
  try {
    const jobId = event.pathParameters?.jobId;
    if (!jobId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Missing jobId path parameter" })
      };
    }
    const result = await dynamo.send(
      new import_lib_dynamodb.GetCommand({
        TableName: JOBS_TABLE,
        Key: { jobId }
      })
    );
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Job ${jobId} not found` })
      };
    }
    const job = result.Item;
    if (job.status === "done" && job.outputPrefix) {
      const baseUrl = `${CLOUDFRONT_OUTPUT_URL}/${job.outputPrefix}`;
      job.outputUrls = {
        sog: `${baseUrl}/scene.sog`,
        collision: `${baseUrl}/scene.collision.glb`,
        thumbnail: `${baseUrl}/thumbnail.jpg`
      };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job)
    };
  } catch (err) {
    console.error("getJob error", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal server error" })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=index.js.map
