import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: process.env.CRMS_ENV_FILE ?? resolve(__dirname, "../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const encryptionKey = Buffer.from(required("CRMS_ENCRYPTION_KEY"), "base64");
if (encryptionKey.length !== 32) {
  throw new Error("CRMS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
}

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  jwtSecret: required("JWT_SECRET"),
  encryptionKey,
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  secureCookies: process.env.COOKIE_SECURE === "true",
  nodeEnv: process.env.NODE_ENV ?? "development"
};

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error("API_PORT must be a valid TCP port");
}
if (config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters");
}
if (config.nodeEnv === "production" &&
    (!config.secureCookies || !config.frontendOrigin.startsWith("https://"))) {
  throw new Error("Production requires COOKIE_SECURE=true and an HTTPS FRONTEND_ORIGIN");
}
