import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { JobWithOutputs } from './types';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const JOBS_TABLE = process.env.JOBS_TABLE!;
const CLOUDFRONT_OUTPUT_URL = process.env.CLOUDFRONT_OUTPUT_URL!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const jobId = event.pathParameters?.jobId;

    if (!jobId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing jobId path parameter' }),
      };
    }

    const result = await dynamo.send(
      new GetCommand({
        TableName: JOBS_TABLE,
        Key: { jobId },
      }),
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Job ${jobId} not found` }),
      };
    }

    const job = result.Item as JobWithOutputs;

    if (job.status === 'done' && job.outputPrefix) {
      const baseUrl = `${CLOUDFRONT_OUTPUT_URL}/${job.outputPrefix}`;
      job.outputUrls = {
        sog: `${baseUrl}/scene.sog`,
        collision: `${baseUrl}/scene.collision.glb`,
        thumbnail: `${baseUrl}/thumbnail.jpg`,
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    };
  } catch (err) {
    console.error('getJob error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
