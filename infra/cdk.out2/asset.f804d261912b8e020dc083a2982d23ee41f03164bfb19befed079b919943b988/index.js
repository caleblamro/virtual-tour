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

// asset-input/src/createJob.ts
var createJob_exports = {};
__export(createJob_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(createJob_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_s3 = require("@aws-sdk/client-s3");
var import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");
var import_crypto = require("crypto");
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
var s3 = new import_client_s3.S3Client({});
var JOBS_TABLE = process.env.JOBS_TABLE;
var UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;
var handler = async (event) => {
  try {
    let userId = "anonymous";
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        if (body.userId && typeof body.userId === "string") {
          userId = body.userId.trim() || "anonymous";
        }
      } catch {
      }
    }
    const jobId = (0, import_crypto.randomUUID)();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await dynamo.send(
      new import_lib_dynamodb.PutCommand({
        TableName: JOBS_TABLE,
        Item: {
          jobId,
          userId,
          status: "uploading",
          createdAt: now,
          updatedAt: now,
          progress: 0
        }
      })
    );
    const s3Key = `uploads/${jobId}/video.mp4`;
    const uploadUrl = await (0, import_s3_request_presigner.getSignedUrl)(
      s3,
      new import_client_s3.PutObjectCommand({
        Bucket: UPLOADS_BUCKET,
        Key: s3Key,
        ContentType: "video/mp4"
      }),
      { expiresIn: 3600 }
    );
    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, uploadUrl })
    };
  } catch (err) {
    console.error("createJob error", err);
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
