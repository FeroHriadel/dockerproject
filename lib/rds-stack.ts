import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';



interface DbCredentials {
  DB_HOST: string;
  DB_PORT: '3306';
  DB_USER: 'admin',
  DB_PASSWORD: string;
  DB_DATABASE: string;
}



const dbName = process.env.DB_NAME!;



export class RdsStack extends cdk.Stack {

  public vpc: cdk.aws_ec2.Vpc;
  private rdsSecurityGroup: cdk.aws_ec2.SecurityGroup;
  private database: cdk.aws_rds.DatabaseInstance;
  public dbCredentials: DbCredentials;
  

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.init();
  }


  private init() {
    this.createVpc();
    this.createRdsSecurityGroup();
    this.addRdsSecuritygroupIngressRule();
    this.createRdsIntance();
    this.populateDbCredentials();
    this.outputDbCredentials();
  }

  private createVpc() {
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
    });
  }

  private createRdsSecurityGroup() {
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc: this.vpc,
      description: 'Allow ECS tasks to connect to the RDS database',
      allowAllOutbound: true,
    });
  }

  private addRdsSecuritygroupIngressRule() {
    this.rdsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3306),
      'Allow MySQL access from developer PCs'
    );
  }

  private createRdsIntance() {
    this.database = new rds.DatabaseInstance(this, 'DatabaseInstance', {
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
      credentials: rds.Credentials.fromGeneratedSecret('admin'), // Auto-generate admin credentials
      multiAz: false, // Disable Multi-AZ for simplicity
      allocatedStorage: 20, // min
      maxAllocatedStorage: 100,
      securityGroups: [this.rdsSecurityGroup], 
      publiclyAccessible: true,
      deletionProtection: false
    });
  }

  private populateDbCredentials() {
    this.dbCredentials = {
      DB_HOST: this.database.dbInstanceEndpointAddress,
      DB_PORT: '3306',
      DB_USER: 'admin',
      DB_PASSWORD: this.database.secret?.secretValueFromJson('password').unsafeUnwrap() || 'UNDEFINED!',
      DB_DATABASE: dbName, //watchout! rds will not: `CREATE DATABASE <dbName>` - this will be a manual step for u 2 do
    }
  }

  private outputDbCredentials() {
    new cdk.CfnOutput(this, 'DbCredentials', {
      value: this.dbCredentials.DB_HOST,
      description: 'DB_HOST',
    });

    new cdk.CfnOutput(this, 'DbUser', {
      value: this.dbCredentials.DB_USER,
      description: 'DB_USER',
    });

    new cdk.CfnOutput(this, 'DbHost', {
      value: this.dbCredentials.DB_HOST,
      description: 'DB_HOST',
    });

    new cdk.CfnOutput(this, 'DbPassword', {
      value: this.dbCredentials.DB_PASSWORD,
      description: 'DB_PASSWORD',
    });

    new cdk.CfnOutput(this, 'DbPort', {
      value: this.dbCredentials.DB_PORT,
      description: 'DB_HOST',
    });

    new cdk.CfnOutput(this, 'DbDatabase', {
      value: `Please manually create datbase ${dbName} in the RDS instance`,
      description: 'DB_DATABASE',
    });
  }

}
