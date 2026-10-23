import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import pg from "pg";
import { config } from "../src/config";

async function createAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters");
  }
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  try {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role)
       VALUES ($1, $2, $3, 'ADMIN')`,
      [randomUUID(), email, await argon2.hash(password, { type: argon2.argon2id })]
    );
    console.info(`Administrator account created for ${email}`);
  } finally {
    await pool.end();
  }
}

createAdmin().catch((error: unknown) => {
  console.error("Could not create administrator", error);
  process.exitCode = 1;
});
