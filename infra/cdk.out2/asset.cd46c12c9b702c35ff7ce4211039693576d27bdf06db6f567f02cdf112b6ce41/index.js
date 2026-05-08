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

// asset-input/src/onUpload.ts
var onUpload_exports = {};
__export(onUpload_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(onUpload_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_batch = require("@aws-sdk/client-batch");
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
var batchClient = new import_client_batch.BatchClient({});
var JOBS_TABLE = process.env.JOBS_TABLE;
var JOB_QUEUE_ARN = process.env.JOB_QUEUE_ARN;
var JOB_DEFINITION_ARN = process.env.JOB_DEFINITION_ARN;
var OUTPUTS_BUCKET = process.env.OUTPUTS_BUCKET;
var handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    console.log(`Processing upload: s3://${bucket}/${key}`);
    const match = key.match(/^uploads\/([^/]+)\/video\.mp4$/);
    if (!match) {
      console.warn(`Skipping unexpected key: ${key}`);
      continue;
    }
    const jobId = match[1];
    try {
      await dynamo.send(
        new import_lib_dynamodb.UpdateCommand({
          TableName: JOBS_TABLE,
          Key: { jobId },
          UpdateExpression: "SET #status = :status, updatedAt = :now",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": "queued",
            ":now": (/* @__PURE__ */ new Date()).toISOString()
          },
          ConditionExpression: "attribute_exists(jobId)"
        })
      );
      const submitResult = await batchClient.send(
        new import_client_batch.SubmitJobCommand({
          jobName: `tour-job-${jobId}`,
          jobQueue: JOB_QUEUE_ARN,
          jobDefinition: JOB_DEFINITION_ARN,
          containerOverrides: {
            environment: [
              { name: "JOB_ID", value: jobId },
              { name: "INPUT_S3_URI", value: `s3://${bucket}/${key}` },
              { name: "OUTPUT_S3_PREFIX", value: jobId },
              { name: "JOBS_TABLE", value: JOBS_TABLE },
              { name: "OUTPUTS_BUCKET", value: OUTPUTS_BUCKET }
            ]
          }
        })
      );
      console.log(
        `Submitted Batch job ${submitResult.jobId} for tour job ${jobId}`
      );
    } catch (err) {
      console.error(`Failed to process upload for jobId=${jobId}`, err);
      try {
        await dynamo.send(
          new import_lib_dynamodb.UpdateCommand({
            TableName: JOBS_TABLE,
            Key: { jobId },
            UpdateExpression: "SET #status = :status, updatedAt = :now, errorMessage = :msg",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":status": "failed",
              ":now": (/* @__PURE__ */ new Date()).toISOString(),
              ":msg": err instanceof Error ? err.message : String(err)
            }
          })
        );
      } catch (innerErr) {
        console.error(`Failed to mark job ${jobId} as failed`, innerErr);
      }
      throw err;
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=index.js.map
