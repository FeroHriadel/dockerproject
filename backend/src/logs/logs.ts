import { 
  CloudWatchLogsClient, 
  CreateLogGroupCommand, 
  CreateLogStreamCommand, 
  PutLogEventsCommand 
} from "@aws-sdk/client-cloudwatch-logs";
import dotenv from "dotenv";
dotenv.config();



const cloudwatchlogs = new CloudWatchLogsClient({ 
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});



const LOG_GROUP_NAME = "/docker-test-backend";
const LOG_STREAM_NAME = process.env.NODE_ENV + "-server-logs";
let sequenceToken: string | undefined;
let isInitialized = false; //will be flagged true after log group and log stream inside it are initialized
const messageQueue: string[] = []; //queues messages sent before the log group and log stream are initialized


const initializeCloudWatch = async () => {
  try {
    // Create log group
    await cloudwatchlogs.send(new CreateLogGroupCommand({ logGroupName: LOG_GROUP_NAME }));
    console.log("Log group created successfully.");
  } catch (err: any) {
    if (err.name === "ResourceAlreadyExistsException") {
      console.log("Log group already exists.");
    } else {
      console.error("Failed to create log group:", err);
      throw err;
    }
  }

  try {
    // Create log stream inside log group
    await cloudwatchlogs.send(new CreateLogStreamCommand({ logGroupName: LOG_GROUP_NAME, logStreamName: LOG_STREAM_NAME }));
    console.log("Log stream created successfully.");
    isInitialized = true;
    processQueue(); //send messages that we queued before the log group and stream were initialized
  } catch (err: any) {
    if (err.name === "ResourceAlreadyExistsException") {
      console.log("Log stream already exists.");
      isInitialized = true;
      processQueue();
    } else {
      console.error("Failed to create log stream:", err);
      throw err;
    }
  }
};

const logToCloudWatch = async (message: string) => {
  if (!isInitialized) {
    console.log("CloudWatch not initialized, queuing message:", message);
    messageQueue.push(message);
    return;
  }

  try {
    const logEvent = {
      logGroupName: LOG_GROUP_NAME,
      logStreamName: LOG_STREAM_NAME,
      logEvents: [
        {
          message,
          timestamp: new Date().getTime(),
        },
      ],
      sequenceToken,
    };
    const response = await cloudwatchlogs.send(new PutLogEventsCommand(logEvent));
    sequenceToken = response.nextSequenceToken;
  } catch (err) {
    console.error("Failed to log to CloudWatch:", err);
  }
};

const processQueue = async () => {
  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    if (message) {
      await logToCloudWatch(message);
    }
  }
};


initializeCloudWatch();

export { logToCloudWatch };
