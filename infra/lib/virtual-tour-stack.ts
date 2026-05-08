import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as path from 'path';

export class VirtualTourStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const account = this.account;
    const region = this.region;

    // ─── S3 Buckets ──────────────────────────────────────────────────────────

    // Uploads bucket: private, CORS for direct browser PUT, 7-day lifecycle
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `tours-uploads-${account}-${region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(7),
          enabled: true,
        },
      ],
    });

    // Outputs bucket: versioned, private — served via CloudFront OAC
    const outputsBucket = new s3.Bucket(this, 'OutputsBucket', {
      bucketName: `tours-outputs-${account}-${region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Viewer bucket: private — served via CloudFront OAC
    const viewerBucket = new s3.Bucket(this, 'ViewerBucket', {
      bucketName: `tour-viewer-${account}-${region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ─── DynamoDB ─────────────────────────────────────────────────────────────

    const jobsTable = new dynamodb.Table(this, 'JobsTable', {
      tableName: 'Jobs',
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    jobsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── ECR ──────────────────────────────────────────────────────────────────

    const ecrRepo = new ecr.Repository(this, 'TourWorkerRepo', {
      repositoryName: 'tour-worker',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteImages: true,
      lifecycleRules: [{ maxImageCount: 3, rulePriority: 1 }],
    });

    // ─── VPC for Batch ────────────────────────────────────────────────────────

    const batchVpc = new ec2.Vpc(this, 'BatchVpc', {
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const batchSecurityGroup = new ec2.SecurityGroup(this, 'BatchSG', {
      vpc: batchVpc,
      description: 'Security group for Batch compute environment',
      allowAllOutbound: true,
    });

    // ─── IAM Roles for Batch ─────────────────────────────────────────────────

    const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
      ],
    });

    const batchInstanceRole = new iam.Role(this, 'BatchInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2ContainerServiceforEC2Role',
        ),
      ],
    });

    // Grant batch instance role access to S3 buckets
    uploadsBucket.grantRead(batchInstanceRole);
    outputsBucket.grantWrite(batchInstanceRole);
    jobsTable.grantReadWriteData(batchInstanceRole);

    const batchInstanceProfile = new iam.CfnInstanceProfile(this, 'BatchInstanceProfile', {
      roles: [batchInstanceRole.roleName],
    });

    // ─── AWS Batch (L1 constructs) ────────────────────────────────────────────

    const computeEnvironment = new batch.CfnComputeEnvironment(this, 'BatchComputeEnv2', {
      type: 'MANAGED',
      state: 'ENABLED',
      serviceRole: `arn:aws:iam::${account}:role/aws-service-role/batch.amazonaws.com/AWSServiceRoleForBatch`,
      computeResources: {
        type: 'SPOT',
        allocationStrategy: 'SPOT_CAPACITY_OPTIMIZED',
        instanceTypes: ['g5.xlarge', 'g4dn.xlarge', 'g5.2xlarge', 'g4dn.2xlarge', 'g4dn.4xlarge'],
        minvCpus: 0,
        maxvCpus: 16,
        desiredvCpus: 0,
        spotIamFleetRole: undefined,
        bidPercentage: 100,
        subnets: batchVpc.publicSubnets.map((s) => s.subnetId),
        securityGroupIds: [batchSecurityGroup.securityGroupId],
        instanceRole: batchInstanceProfile.attrArn,
        tags: {
          Project: 'virtual-tour',
        },
      },
    });

    const jobQueue = new batch.CfnJobQueue(this, 'JobQueue', {
      jobQueueName: 'tour-jobs-queue',
      state: 'ENABLED',
      priority: 1,
      computeEnvironmentOrder: [
        {
          order: 1,
          computeEnvironment: computeEnvironment.ref,
        },
      ],
    });

    const jobDefinition = new batch.CfnJobDefinition(this, 'JobDefinition', {
      jobDefinitionName: 'tour-worker-job',
      type: 'container',
      containerProperties: {
        image: ecrRepo.repositoryUri + ':latest',
        command: [],
        vcpus: 4,
        memory: 14000,
        environment: [],
      },
      timeout: {
        attemptDurationSeconds: 3600,
      },
      retryStrategy: {
        attempts: 1,
      },
    });

    // ─── Lambda Common Config ─────────────────────────────────────────────────

    const commonEnv: Record<string, string> = {
      JOBS_TABLE: jobsTable.tableName,
      UPLOADS_BUCKET: uploadsBucket.bucketName,
      OUTPUTS_BUCKET: outputsBucket.bucketName,
      JOB_QUEUE_ARN: jobQueue.ref,
      JOB_DEFINITION_ARN: jobDefinition.ref,
    };

    const bundling: lambda_nodejs.BundlingOptions = {
      minify: false,
      sourceMap: true,
      externalModules: ['@aws-sdk/*'],
    };

    const apiDir = path.join(__dirname, '../../api');

    const lambdaDefaults: Partial<lambda_nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling,
      environment: commonEnv,
      projectRoot: apiDir,
      depsLockFilePath: path.join(apiDir, 'package-lock.json'),
    };

    const apiSrcDir = path.join(__dirname, '../../api/src');

    // ─── Lambda Functions ─────────────────────────────────────────────────────

    const createJobFn = new lambda_nodejs.NodejsFunction(this, 'CreateJobFn', {
      ...lambdaDefaults,
      functionName: 'virtual-tour-createJob',
      entry: path.join(apiSrcDir, 'createJob.ts'),
      handler: 'handler',
    });

    const getJobFn = new lambda_nodejs.NodejsFunction(this, 'GetJobFn', {
      ...lambdaDefaults,
      functionName: 'virtual-tour-getJob',
      entry: path.join(apiSrcDir, 'getJob.ts'),
      handler: 'handler',
    });

    const listJobsFn = new lambda_nodejs.NodejsFunction(this, 'ListJobsFn', {
      ...lambdaDefaults,
      functionName: 'virtual-tour-listJobs',
      entry: path.join(apiSrcDir, 'listJobs.ts'),
      handler: 'handler',
    });

    const onUploadFn = new lambda_nodejs.NodejsFunction(this, 'OnUploadFn', {
      ...lambdaDefaults,
      functionName: 'virtual-tour-onUpload',
      entry: path.join(apiSrcDir, 'onUpload.ts'),
      handler: 'handler',
    });

    // ─── Lambda Permissions ───────────────────────────────────────────────────

    uploadsBucket.grantWrite(createJobFn);
    outputsBucket.grantRead(createJobFn);
    jobsTable.grantWriteData(createJobFn);

    jobsTable.grantReadData(getJobFn);
    outputsBucket.grantRead(getJobFn);

    jobsTable.grantReadData(listJobsFn);

    jobsTable.grantWriteData(onUploadFn);
    onUploadFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['batch:SubmitJob'],
        resources: [jobQueue.ref, jobDefinition.ref],
      }),
    );

    // ─── S3 Notification ─────────────────────────────────────────────────────

    uploadsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(onUploadFn),
    );

    // ─── CloudFront Distributions ─────────────────────────────────────────────

    const outputsDistribution = new cloudfront.Distribution(this, 'OutputsDistribution', {
      defaultBehavior: {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(outputsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      comment: 'Virtual Tour Outputs CDN',
    });

    const viewerDistribution = new cloudfront.Distribution(this, 'ViewerDistribution', {
      defaultBehavior: {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(viewerBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      comment: 'Virtual Tour Viewer CDN',
    });

    // Pass CloudFront URL into getJob lambda
    getJobFn.addEnvironment(
      'CLOUDFRONT_OUTPUT_URL',
      `https://${outputsDistribution.distributionDomainName}`,
    );

    // ─── API Gateway (HTTP API) ───────────────────────────────────────────────

    const httpApi = new apigwv2.HttpApi(this, 'VirtualTourApi', {
      apiName: 'virtual-tour-api',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'x-api-key'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(1),
      },
    });

    httpApi.addRoutes({
      path: '/jobs',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2_integrations.HttpLambdaIntegration(
        'CreateJobIntegration',
        createJobFn,
      ),
    });

    httpApi.addRoutes({
      path: '/jobs/{jobId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2_integrations.HttpLambdaIntegration(
        'GetJobIntegration',
        getJobFn,
      ),
    });

    httpApi.addRoutes({
      path: '/jobs',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2_integrations.HttpLambdaIntegration(
        'ListJobsIntegration',
        listJobsFn,
      ),
    });

    // ─── CloudFormation Outputs ───────────────────────────────────────────────

    new cdk.CfnOutput(this, 'ApiUrl', {
      exportName: 'VirtualTourApiUrl',
      value: httpApi.apiEndpoint,
      description: 'HTTP API endpoint URL',
    });

    new cdk.CfnOutput(this, 'ViewerUrl', {
      exportName: 'VirtualTourViewerUrl',
      value: `https://${viewerDistribution.distributionDomainName}`,
      description: 'CloudFront URL for the viewer app',
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      exportName: 'VirtualTourUploadsBucket',
      value: uploadsBucket.bucketName,
      description: 'S3 bucket for raw video uploads',
    });

    new cdk.CfnOutput(this, 'OutputsBucketName', {
      exportName: 'VirtualTourOutputsBucket',
      value: outputsBucket.bucketName,
      description: 'S3 bucket for processed tour outputs',
    });

    new cdk.CfnOutput(this, 'JobsTableName', {
      exportName: 'VirtualTourJobsTable',
      value: jobsTable.tableName,
      description: 'DynamoDB table for job records',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      exportName: 'VirtualTourEcrRepository',
      value: ecrRepo.repositoryUri,
      description: 'ECR repository URI for the worker image',
    });

    new cdk.CfnOutput(this, 'JobQueueArn', {
      exportName: 'VirtualTourJobQueueArn',
      value: jobQueue.ref,
      description: 'ARN of the Batch job queue',
    });

    new cdk.CfnOutput(this, 'JobDefinitionArn', {
      exportName: 'VirtualTourJobDefinitionArn',
      value: jobDefinition.ref,
      description: 'ARN of the Batch job definition',
    });
  }
}
