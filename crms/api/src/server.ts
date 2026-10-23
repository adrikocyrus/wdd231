import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config";
import { pool } from "./db";
import { attachRealtime } from "./realtime";
import { registerRoutes } from "./routes";
import { jobs, redisHealth } from "./queue";

async function start() {
  const app = Fastify({
    logger: {
      redact: ["req.headers.cookie", "req.headers.authorization", "req.body.password"]
    },
    bodyLimit: 1_048_576,
    trustProxy: config.nodeEnv === "production"
  });
  await app.register(helmet, {
    hsts: config.nodeEnv === "production"
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false
  });
  await app.register(cors, {
    origin: config.frontendOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"]
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: "crms_token", signed: false },
    sign: { expiresIn: "15m" }
  });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute"
  });
  await registerRoutes(app);
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    if (error.validation) {
      return reply.code(400).send({ error: "Request validation failed" });
    }
    if ("code" in error && error.code === "23505") {
      return reply.code(409).send({ error: "A record with those unique details already exists" });
    }
    return reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500)
      .send({ error: error.statusCode && error.statusCode < 500 ? error.message : "Internal server error" });
  });
  const realtime = await attachRealtime(app.server);
  app.decorate("io", realtime.io);

  const shutdown = async () => {
    await Promise.all([realtime.close(), app.close(), jobs.close()]);
    await redisHealth.quit();
    await pool.end();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

start().catch((error: unknown) => {
  console.error("CRMS API failed to start", error);
  process.exitCode = 1;
});
