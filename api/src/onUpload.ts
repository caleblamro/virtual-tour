import { S3Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const batchClient = new BatchClient({});

const JOBS_TABLE = process.env.JOBS_TABLE!;
const JOB_QUEUE_ARN = process.env.JOB_QUEUE_ARN!;
const JOB_DEFINITION_ARN = process.env.JOB_DEFINITION_ARN!;
const OUTPUTS_BUCKET = process.env.OUTPUTS_BUCKET!;

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // Keys may be URL-encoded (spaces → +, special chars → %XX)
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing upload: s3://${bucket}/${key}`);

    // Expected format: uploads/{jobId}/video.mp4
    const match = key.match(/^uploads\/([^/]+)\/video\.mp4$/);
    if (!match) {
      console.warn(`Skipping unexpected key: ${key}`);
      continue;
    }

    const jobId = match[1];

    try {
      // Update job status to 'queued'
      await dynamo.send(
        new UpdateCommand({
          TableName: JOBS_TABLE,
          Key: { jobId },
          UpdateExpression: 'SET #status = :status, updatedAt = :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'queued',
            ':now': new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(jobId)',
        }),
      );

      // Submit Batch job
      const submitResult = await batchClient.send(
        new SubmitJobCommand({
          jobName: `tour-job-${jobId}`,
          jobQueue: JOB_QUEUE_ARN,
          jobDefinition: JOB_DEFINITION_ARN,
          containerOverrides: {
            environment: [
              { name: 'JOB_ID', value: jobId },
              { name: 'INPUT_S3_URI', value: `s3://${bucket}/${key}` },
              { name: 'OUTPUT_S3_PREFIX', value: jobId },
              { name: 'JOBS_TABLE', value: JOBS_TABLE },
              { name: 'OUTPUTS_BUCKET', value: OUTPUTS_BUCKET },
            ],
          },
        }),
      );

      console.log(
        `Submitted Batch job ${submitResult.jobId} for tour job ${jobId}`,
      );
    } catch (err) {
      console.error(`Failed to process upload for jobId=${jobId}`, err);
      // Mark job as failed so the client isn't stuck waiting
      try {
        await dynamo.send(
          new UpdateCommand({
            TableName: JOBS_TABLE,
            Key: { jobId },
            UpdateExpression: 'SET #status = :status, updatedAt = :now, errorMessage = :msg',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'failed',
              ':now': new Date().toISOString(),
              ':msg': err instanceof Error ? err.message : String(err),
            },
          }),
        );
      } catch (innerErr) {
        console.error(`Failed to mark job ${jobId} as failed`, innerErr);
      }
      throw err; // re-throw so Lambda marks this record as failed
    }
  }
};
