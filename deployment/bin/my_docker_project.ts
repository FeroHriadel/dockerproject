#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RdsStack } from '../lib/rds-stack';
import { EcrStack } from '../lib/ecr-stack';
import * as dotenv from 'dotenv';
dotenv.config();



const region = process.env.AWS_REGION!;
const account = process.env.AWS_ACCOUNT!;



const app = new cdk.App();
const rdsStack = new RdsStack(app, 'RdsStack', {env: {account, region}});
const ecrStack = new EcrStack(app, 'EcrStack', {env: {account, region}});