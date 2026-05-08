import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const JOBS_TABLE = process.env.JOBS_TABLE!;
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    let userId = 'anonymous';

    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        if (body.userId && typeof body.userId === 'string') {
          userId = body.userId.trim() || 'anonymous';
        }
      } catch {
        // malformed JSON — fall through with default userId
      }
    }

    const jobId = randomUUID();
    const now = new Date().toISOString();

    await dynamo.send(
      new PutCommand({
        TableName: JOBS_TABLE,
        Item: {
          jobId,
          userId,
          status: 'uploading',
          createdAt: now,
          updatedAt: now,
          progress: 0,
        },
      }),
    );

    const s3Key = `uploads/${jobId}/video.mp4`;

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: UPLOADS_BUCKET,
        Key: s3Key,
        ContentType: 'video/mp4',
      }),
      { expiresIn: 3600 },
    );

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, uploadUrl }),
    };
  } catch (err) {
    console.error('createJob error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
