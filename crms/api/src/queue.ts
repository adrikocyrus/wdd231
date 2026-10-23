import { Queue } from "bullmq";
import Redis from "ioredis";
import { config } from "./config";

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
export const jobs = new Queue("crms-jobs", { connection });
export const redisHealth = connection;
