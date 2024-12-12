/************************************************************************************************************************
Before deploying this stack a manual step must be taken: Go to github, create access token and put it in Secrets Manager.
Put the github token & other github details into .env

- Create a github token like this:
  go to your Github / click ur profile picture (right up) / Settings (left sidebar) Developer Settings / Personal Access Tokens / Tokens (classic) Generate new token / choose classic / Select scopes: repo & admin:repo_hook / name it e.g.: `github-token` / Generate token Copy the value of the token (something like: `ghp_66PWc461Drgh0nvEFiiKnsabzPJtZf2583Wq`)

- Put the github token in AWS / SECRETS MANAGER under the name github-token like this:
  copy the value of the github-token and go to AWS / SECRETS MANAGER / Store a new secret / Other type of secret / Next in Key/value pair section click Plaintext tab and paste the github-token there / Next / Secret name: github-token / Next / complete the procedure…

- add the Secret Manager github-token arn into .env + add your github details:
  GITHUB_TOKEN_SECRET_ARN=arn:aws:secretsmanager:us-east-1:991342932037:secret:github-token-SZacAA
  GITHUB_OWNER=FeroHriadel
  GITHUB_REPO=dockerproject
  GITHUB_BRANCH=main
*************************************************************************************************************************/

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dotenv from 'dotenv';
dotenv.config();



interface PipelineStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  ecrRepositoryUri: string;
  ecrRepositoryArn: string;
  fargateServiceArn: string;
  ecsClusterArn: string;
  ecsClusterName: string;
  githubRepo: string;
  githubOwner: string;
  githubBranch: string;
  githubTokenSecretArn: string;
}



const region = process.env.AWS_REGION!;
const account = process.env.AWS_ACCOUNT!;



export class PipelineStack extends cdk.Stack {
  private vpc: ec2.Vpc;
  private ecrRepositoryUri: string;
  private ecrRepositoryArn: string;
  private fargateServiceArn: string;
  private ecsClusterArn: string;
  private ecsClusterName: string;
  private githubRepo: string;
  private githubOwner: string;
  private githubBranch: string;
  private githubTokenSecretArn: string;
  private sourceOutput: cdk.aws_codepipeline.Artifact;
  private sourceAction: cdk.aws_codepipeline_actions.GitHubSourceAction;
  private buildProject: cdk.aws_codebuild.PipelineProject;
  private buildOutput: cdk.aws_codepipeline.Artifact;
  private buildAction: cdk.aws_codepipeline_actions.CodeBuildAction;
  private deployAction: cdk.aws_codepipeline_actions.EcsDeployAction;
  private pipeline: cdk.aws_codepipeline.Pipeline;
  private deployRole: iam.Role;


  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    this.vpc = props.vpc;
    this.ecrRepositoryUri = props.ecrRepositoryUri;
    this.ecrRepositoryArn = props.ecrRepositoryArn;
    this.fargateServiceArn = props.fargateServiceArn;
    this.ecsClusterArn = props.ecsClusterArn;
    this.ecsClusterName = props.ecsClusterName;
    this.githubRepo = props.githubRepo;
    this.githubOwner = props.githubOwner;
    this.githubBranch = props.githubBranch;
    this.githubTokenSecretArn = props.githubTokenSecretArn;
    this.init();
  }

  private init() {
    this.createSourceStep();
    this.createBuildStep();
    this.addBuildProjectRights();
    this.createDeployRole();
    this.createDeployStep();
    this.createPipeline();
    this.addPipelineRights();
  }

  private createSourceStep() {
    //on github push: create artifact with the new code
    this.sourceOutput = new codepipeline.Artifact();
    this.sourceAction = new codepipelineActions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: this.githubOwner,
      repo: this.githubRepo,
      branch: this.githubBranch,
      oauthToken: cdk.SecretValue.secretsManager(this.githubTokenSecretArn),
      output: this.sourceOutput,
    });
  }

  private createBuildStep() {
    //build backend image and push it to ECR repo
    this.buildProject = new codebuild.PipelineProject(this, 'DockerBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true, // Required for Docker builds
      },
      environmentVariables: {
        ECR_REPO_URI: { value: this.ecrRepositoryUri },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI',
            ],
          },
          build: {
            commands: [
              'cd backend',
              'docker build -t $ECR_REPO_URI:latest .',
              'docker push $ECR_REPO_URI:latest',
            ],
          },
        },
      }),
    });

    this.buildOutput = new codepipeline.Artifact();
    this.buildAction = new codepipelineActions.CodeBuildAction({
      actionName: 'Docker_Build',
      project: this.buildProject,
      input: this.sourceOutput,
      outputs: [this.buildOutput],
    });
  }

  private addBuildProjectRights() {
    // Allow getting ECR authorization token (needs to be at account level)
    this.buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],  // This permission can only be granted at account level
        effect: iam.Effect.ALLOW
      })
    );
    // Allow pushing images to ECR
    this.buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'ecr:GetAuthorizationToken', 
          'ecr:BatchCheckLayerAvailability', 
          'ecr:BatchGetImage', 
          'ecr:PutImage',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
          'ecr:GetDownloadUrlForLayer'
        ],
        resources: [this.ecrRepositoryArn],
        effect: iam.Effect.ALLOW
      })
    );
  }

  private createDeployRole() {
    // Create the role with basic trust relationship
    this.deployRole = new iam.Role(this, 'EcsDeployActionRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      roleName: `${this.stackName}-ecs-deploy-role`,
    });
  
    // Add necessary permissions to the role
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecs:DescribeServices',
        'ecs:DescribeTaskDefinition',
        'ecs:DescribeTasks',
        'ecs:ListTasks',
        'ecs:RegisterTaskDefinition',
        'ecs:UpdateService'
      ],
      resources: ['*']
    }));
  }

  private createDeployStep() { 
    this.deployAction = new codepipelineActions.EcsDeployAction({
      actionName: 'Deploy_to_Fargate',
      service: ecs.FargateService.fromFargateServiceAttributes(this, 'FargateService', {
        serviceArn: this.fargateServiceArn,
        cluster: ecs.Cluster.fromClusterAttributes(this, 'Cluster', {
          clusterArn: this.ecsClusterArn,
          clusterName: this.ecsClusterName,
          vpc: this.vpc,
        }),
      }),
      input: this.buildOutput,
      role: this.deployRole
    });
  }
  
  private createPipeline() {
    //create pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [this.sourceAction],
        },
        {
          stageName: 'Build',
          actions: [this.buildAction],
        },
        {
          stageName: 'Deploy',
          actions: [this.deployAction],
        },
      ],
    });
  }

  //it's okay to add rights at the end - CDK figures it out and creates rights first, only then does it deploy resources...
  private addPipelineRights() {
    //Allow pipeline to access github-token in Secrets Manager (sourceAction neeeds it)
    this.pipeline.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [this.githubTokenSecretArn]
      })
    );
    //Allow the pipeline to assume CodeBuild.role (we customized CodeBuild.role by allowing it to push to ECR -that's why we have to let pipeline assume its role)
    this.pipeline.role.addToPrincipalPolicy( 
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [this.buildProject.role!.roleArn]
      })
    );
    //Add pipeline role to deploy role's policy
    this.deployRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        principals: [new iam.ArnPrincipal(this.pipeline.role.roleArn)]
      })
    );
    // Add permission to pipeline role to assume deploy role
    this.pipeline.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [this.deployRole.roleArn]
      })
    );
  }

}






    
    

