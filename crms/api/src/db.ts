import pg from "pg";
import { config } from "./config";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 15,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
});

export type DbClient = pg.PoolClient;
