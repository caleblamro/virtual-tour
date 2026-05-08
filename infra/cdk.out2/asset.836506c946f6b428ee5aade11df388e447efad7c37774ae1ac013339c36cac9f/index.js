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

// asset-input/src/listJobs.ts
var listJobs_exports = {};
__export(listJobs_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(listJobs_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
var JOBS_TABLE = process.env.JOBS_TABLE;
var DEFAULT_LIMIT = 50;
var MAX_LIMIT = 100;
var handler = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Missing required query parameter: userId" })
      };
    }
    const limitParam = parseInt(event.queryStringParameters?.limit ?? "", 10);
    const limit = isNaN(limitParam) ? DEFAULT_LIMIT : Math.min(limitParam, MAX_LIMIT);
    const lastKeyParam = event.queryStringParameters?.lastKey;
    const exclusiveStartKey = lastKeyParam ? JSON.parse(Buffer.from(lastKeyParam, "base64").toString("utf-8")) : void 0;
    const result = await dynamo.send(
      new import_lib_dynamodb.QueryCommand({
        TableName: JOBS_TABLE,
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey
      })
    );
    const jobs = result.Items ?? [];
    const nextKey = result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") : void 0;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs, count: jobs.length, ...nextKey && { nextKey } })
    };
  } catch (err) {
    console.error("listJobs error", err);
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
