#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VirtualTourStack } from '../lib/virtual-tour-stack';

const app = new cdk.App();
new VirtualTourStack(app, 'VirtualTourStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
