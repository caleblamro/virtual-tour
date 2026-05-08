import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Job } from './types';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const JOBS_TABLE = process.env.JOBS_TABLE!;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing required query parameter: userId' }),
      };
    }

    const limitParam = parseInt(event.queryStringParameters?.limit ?? '', 10);
    const limit = isNaN(limitParam) ? DEFAULT_LIMIT : Math.min(limitParam, MAX_LIMIT);

    const lastKeyParam = event.queryStringParameters?.lastKey;
    const exclusiveStartKey = lastKeyParam
      ? JSON.parse(Buffer.from(lastKeyParam, 'base64').toString('utf-8'))
      : undefined;

    const result = await dynamo.send(
      new QueryCommand({
        TableName: JOBS_TABLE,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    const jobs = (result.Items ?? []) as Job[];
    const nextKey = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, count: jobs.length, ...(nextKey && { nextKey }) }),
    };
  } catch (err) {
    console.error('listJobs error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
