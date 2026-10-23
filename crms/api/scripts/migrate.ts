import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { config } from "../src/config";

async function migrate() {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(23123123)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const name = "001_initial_schema.sql";
    const exists = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    if (exists.rowCount) {
      console.info(`Migration ${name} already applied`);
      return;
    }
    const sql = await readFile(resolve(__dirname, "../../database/migrations", name), "utf8");
    const statements = sql.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
    await client.query("BEGIN");
    try {
      await client.query(statements);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.info(`Applied ${name}`);
  } finally {
    await client.query("SELECT pg_advisory_unlock(23123123)");
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error("Database migration failed", error);
  process.exitCode = 1;
});
