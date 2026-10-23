import { Worker } from "bullmq";
import Redis from "ioredis";
import { config } from "./config";

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const worker = new Worker("crms-jobs", async (job) => {
  if (job.name === "ticket-ready") {
    console.info(`Ticket ${String(job.data.ticketId)} is ready for pickup`);
    return { handled: true };
  }
  throw new Error(`Unsupported job: ${job.name}`);
}, {
  connection,
  concurrency: 5
});

worker.on("failed", (job, error) => {
  console.error(`Background job ${job?.id ?? "unknown"} failed`, error);
});

const shutdown = async () => {
  await worker.close();
  await connection.quit();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
