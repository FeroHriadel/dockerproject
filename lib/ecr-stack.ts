import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as dotenv from 'dotenv';
dotenv.config();



export class EcrStack extends cdk.Stack {
  
  public ecrRepository: cdk.aws_ecr.Repository;


  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    this.init();
  }


  private init() {
    this.createEcrRepository();
    this.outputEcrRepoUri();
  }

  private createEcrRepository() {
    this.ecrRepository = new ecr.Repository(this, 'NodeApiRepository', {
      repositoryName: 'nodejs-api',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [{ maxImageAge: cdk.Duration.days(30) }],
    });
  }

  private outputEcrRepoUri() {
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'The URI of the ECR repository',
    });
  }

}