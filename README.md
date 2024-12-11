# MY DOCKER PROJECT
This project shows how to:
- dockerize nodeJS api
- dockerize nextJS frontend
- deploy all on AWS ECS with Fargate and ALB.

<br />


## BACKEND - LOCAL DEVELOPMENT
First try on your local machine:
- start mysqlDb locally like this:
- install and run Docker Desktop
- $ `cd dev_db`
- $ `docker-compose up -d`

<br />

Then run backend locally:
- $ `cd backend`
- create .env:

```
NODE_ENV=dev
PORT=80
DB_HOST='127.0.0.1'
DB_PORT=3306
DB_USER=dev_user
DB_PASSWORD=dev_password
DB_DATABASE=dev_db
```

- $ `npm run dev`
- navigate to `http://localhost:80/api/items` to see if you get a successful response

<br />

## BACKEND - DEPLOYMENT
deploy backend to AWS in steps:
- $ `cd deployment`
- create `.env` with:

```
AWS_REGION=us-east-1 
AWS_ACCOUNT=0123456789012
DB_NAME=dockertestdb
```

### STEP 1 - DEPLOY RDS
- $ `cdk deploy RdsStack --profile fhyahoo`
- then do the manual step:

```
After deploying this stack, please connect to the created RDS Instance (thru e.g.: MySqlWorkbench)
The password for the connection will be in AWS Console / Secrets Manager
Once connected, create a database with the name of whatever you have in .env/DB_NAME (I have `dockertestdb`). Like this:
$ CREATE DATABASE dockertestdb;
```

### STEP 2 - DEPLOY ECR
- $ `cdk deploy EcrStack --profile fhyahoo`
- then do the manual step:

```
When this stack is deployed for the first time you will need to push the backend docker image into the created ecr repo.
It's easy to do. Run these commands:

cd backend
aws ecr get-login-password --region us-east-1 --profile fhyahoo | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t nodejs-api:latest .
docker tag nodejs-api:latest <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/nodejs-api:latest
docker push <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/nodejs-api:latest
```

### STEP 3 - DEPLOY ECS
- $ `cdk deploy EcsStack --profile fhyahoo`
- Once deployed go to the http://FargateEndpoint that prints after the deployment and check the server is running.