import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { authenticate, authorize } from "./auth";
import { config } from "./config";
import { pool } from "./db";
import { decrypt, encrypt } from "./encryption";
import { jobs, redisHealth } from "./queue";
import type { Server as SocketServer } from "socket.io";

const uuid = Type.String({ format: "uuid" });
const ticketStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "CANCELLED"
] as const;
const loginBody = Type.Object({
  email: Type.String({ format: "email", maxLength: 320 }),
  password: Type.String({ minLength: 1, maxLength: 128 })
});
const customerBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 160, pattern: ".*\\S.*" }),
  phone: Type.String({ minLength: 7, maxLength: 40, pattern: "^\\+?[0-9][0-9().\\s-]{5,38}[0-9]$" }),
  address: Type.Optional(Type.String({ maxLength: 500 })),
  email: Type.Optional(Type.String({ format: "email", maxLength: 320 })),
  password: Type.Optional(Type.String({ minLength: 12, maxLength: 128 })),
});
const ticketBody = Type.Object({
  customer_id: Type.Optional(uuid),
  device_type: Type.String({ minLength: 1, maxLength: 100, pattern: ".*\\S.*" }),
  serial_number: Type.Optional(Type.String({ maxLength: 200 })),
  issue_description: Type.String({ minLength: 1, maxLength: 4000, pattern: ".*\\S.*" }),
  estimated_cost: Type.Optional(Type.Number({ minimum: 0, maximum: 99999999.99, multipleOf: 0.01 }))
});
const inventoryBody = Type.Object({
  sku: Type.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" }),
  name: Type.String({ minLength: 1, maxLength: 160, pattern: ".*\\S.*" }),
  quantity_on_hand: Type.Integer({ minimum: 0, maximum: 2147483647 }),
  unit_price: Type.Number({ minimum: 0, maximum: 99999999.99, multipleOf: 0.01 })
});
const completeBody = Type.Object({
  parts: Type.Array(Type.Object({
    inventory_id: uuid,
    quantity: Type.Integer({ minimum: 1, maximum: 100000 })
  }), { maxItems: 100 }),
  labor: Type.Number({ minimum: 0, maximum: 99999999.99, multipleOf: 0.01 }),
  tax: Type.Number({ minimum: 0, maximum: 99999999.99, multipleOf: 0.01 }),
  currency: Type.String({ pattern: "^[A-Z]{3}$" })
});

type TicketRow = {
  id: string;
  customer_id: string;
  customer_name_ciphertext: Buffer;
  customer_name_key_version: number;
  customer_phone_ciphertext: Buffer;
  customer_phone_key_version: number;
  device_type: string;
  serial_number_ciphertext: Buffer | null;
  serial_number_key_version: number | null;
  issue_description: string;
  status: (typeof ticketStatuses)[number];
  estimated_cost: string | null;
  assigned_to: string | null;
  assigned_email: string | null;
  version: number;
  created_at: Date;
};

function presentTicket(row: TicketRow) {
  return {
    id: row.id,
    customer_id: row.customer_id,
    customer_name: decrypt(row.customer_name_ciphertext, row.customer_name_key_version),
    customer_phone: decrypt(row.customer_phone_ciphertext, row.customer_phone_key_version),
    device_type: row.device_type,
    serial_number: row.serial_number_ciphertext && row.serial_number_key_version
      ? decrypt(row.serial_number_ciphertext, row.serial_number_key_version)
      : null,
    issue_description: row.issue_description,
    status: row.status,
    estimated_cost: row.estimated_cost === null ? null : Number(row.estimated_cost),
    assigned_to: row.assigned_to,
    assigned_email: row.assigned_email,
    version: row.version,
    created_at: row.created_at
  };
}

async function customerIdForUser(userId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM customers WHERE user_id = $1",
    [userId]
  );
  return result.rows[0]?.id ?? null;
}

async function insertHistory(
  client: Awaited<ReturnType<typeof pool.connect>>,
  ticketId: string,
  fromStatus: string | null,
  toStatus: string,
  actorId: string
) {
  await client.query(
    `INSERT INTO ticket_status_history (id, ticket_id, from_status, to_status, changed_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), ticketId, fromStatus, toStatus, actorId]
  );
}

async function broadcastTicket(
  io: SocketServer | undefined,
  ticketId: string,
  status: string,
  logger: FastifyBaseLogger
) {
  if (!io) return;
  io.to("staff").emit("ticket:changed", { id: ticketId, status });
  try {
    const result = await pool.query<{ user_id: string | null }>(
      `SELECT c.user_id
       FROM tickets t JOIN customers c ON c.id = t.customer_id
       WHERE t.id = $1`,
      [ticketId]
    );
    const customerUserId = result.rows[0]?.user_id;
    if (customerUserId) {
      io.to(`customer:${customerUserId}`).emit("ticket:changed", { id: ticketId, status });
    }
  } catch (error) {
    logger.error({ err: error, ticketId }, "Could not notify customer about ticket update");
  }
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    await Promise.all([pool.query("SELECT 1"), redisHealth.ping()]);
    return reply.send({ status: "ok" });
  });

  app.post("/api/auth/login", {
    schema: { body: loginBody },
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const body = request.body as { email: string; password: string };
    const result = await pool.query<{
      id: string; email: string; password_hash: string; role: "ADMIN" | "TECHNICIAN" | "CUSTOMER";
      is_active: boolean;
    }>(
      "SELECT id, email, password_hash, role, is_active FROM users WHERE lower(email) = lower($1)",
      [body.email.trim()]
    );
    const user = result.rows[0];
    if (!user || !user.is_active || !(await argon2.verify(user.password_hash, body.password))) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }
    const token = app.jwt.sign({ id: user.id, role: user.role }, { expiresIn: "15m" });
    return reply
      .setCookie("crms_token", token, {
        httpOnly: true,
        secure: config.secureCookies,
        sameSite: "strict",
        path: "/",
        maxAge: 15 * 60
      })
      .send({ user: { id: user.id, email: user.email, role: user.role } });
  });

  app.post("/api/auth/logout", async (_request, reply) =>
    reply.clearCookie("crms_token", { path: "/" }).code(204).send());

  app.post("/api/auth/password", {
    preHandler: authenticate,
    schema: {
      body: Type.Object({
        current_password: Type.String({ minLength: 1, maxLength: 128 }),
        new_password: Type.String({ minLength: 12, maxLength: 128 })
      })
    }
  }, async (request, reply) => {
    const body = request.body as { current_password: string; new_password: string };
    const result = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1 AND is_active = TRUE",
      [request.user.id]
    );
    const account = result.rows[0];
    if (!account || !(await argon2.verify(account.password_hash, body.current_password))) {
      return reply.code(400).send({ error: "Current password is incorrect" });
    }
    await pool.query(
      "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
      [request.user.id, await argon2.hash(body.new_password, { type: argon2.argon2id })]
    );
    return { status: "password_updated" };
  });

  app.get("/api/team", {
    preHandler: [authenticate, authorize("ADMIN")]
  }, async () => {
    const result = await pool.query(
      `SELECT id, email, role, is_active, created_at
       FROM users WHERE role IN ('ADMIN', 'TECHNICIAN') ORDER BY created_at DESC`
    );
    return result.rows;
  });

  app.post("/api/team", {
    preHandler: [authenticate, authorize("ADMIN")],
    schema: {
      body: Type.Object({
        email: Type.String({ format: "email", maxLength: 320 }),
        password: Type.String({ minLength: 12, maxLength: 128 }),
        role: Type.Union([Type.Literal("ADMIN"), Type.Literal("TECHNICIAN")])
      })
    }
  }, async (request, reply) => {
    const body = request.body as { email: string; password: string; role: "ADMIN" | "TECHNICIAN" };
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, is_active, created_at`,
      [randomUUID(), body.email.trim(), await argon2.hash(body.password, { type: argon2.argon2id }), body.role]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/api/invoices", { preHandler: authenticate }, async (request) => {
    const customerId = request.user.role === "CUSTOMER"
      ? await customerIdForUser(request.user.id)
      : null;
    if (request.user.role === "CUSTOMER" && !customerId) return [];
    const result = await pool.query<{
      id: string; ticket_id: string; customer_id: string;
      customer_name_ciphertext: Buffer; customer_name_key_version: number;
      subtotal: string; tax: string; total: string; currency: string;
      status: string; issued_at: Date;
    }>(
      `SELECT i.id, i.ticket_id, t.customer_id, c.name_ciphertext AS customer_name_ciphertext,
              c.name_key_version AS customer_name_key_version, i.subtotal, i.tax, i.total,
              i.currency, i.status, i.issued_at
       FROM invoices i
       JOIN tickets t ON t.id = i.ticket_id
       JOIN customers c ON c.id = t.customer_id
       WHERE ($1::uuid IS NULL OR t.customer_id = $1)
       ORDER BY i.issued_at DESC LIMIT 500`,
      [customerId]
    );
    return result.rows.map((invoice) => {
      const {
        customer_name_ciphertext: _ciphertext,
        customer_name_key_version: _keyVersion,
        ...safeInvoice
      } = invoice;
      return {
      ...safeInvoice,
      customer_name: decrypt(invoice.customer_name_ciphertext, invoice.customer_name_key_version),
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total)
      };
    });
  });

  app.patch("/api/invoices/:id/status", {
    preHandler: [authenticate, authorize("ADMIN")],
    schema: {
      params: Type.Object({ id: uuid }),
      body: Type.Object({ status: Type.Union([Type.Literal("PAID"), Type.Literal("VOID")]) })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: "PAID" | "VOID" };
    const result = await pool.query(
      `UPDATE invoices SET status = $2
       WHERE id = $1 AND status = 'ISSUED'
       RETURNING id, status`,
      [id, status]
    );
    if (!result.rowCount) return reply.code(409).send({ error: "Invoice is no longer issued" });
    return result.rows[0];
  });

  app.get("/api/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const result = await pool.query<{ email: string; role: string }>(
      "SELECT email, role FROM users WHERE id = $1 AND is_active = TRUE",
      [request.user.id]
    );
    const user = result.rows[0];
    if (!user) return reply.code(401).send({ error: "Account is inactive" });
    return { id: request.user.id, email: user.email, role: user.role };
  });

  app.get("/api/customers", { preHandler: [authenticate, authorize("ADMIN", "TECHNICIAN")] }, async () => {
    const result = await pool.query<{
      id: string; name_ciphertext: Buffer; name_key_version: number;
      phone_ciphertext: Buffer; phone_key_version: number; address_ciphertext: Buffer | null;
      address_key_version: number | null; created_at: Date;
    }>("SELECT * FROM customers ORDER BY created_at DESC LIMIT 500");
    return result.rows.map((customer) => ({
      id: customer.id,
      name: decrypt(customer.name_ciphertext, customer.name_key_version),
      phone: decrypt(customer.phone_ciphertext, customer.phone_key_version),
      address: customer.address_ciphertext && customer.address_key_version
        ? decrypt(customer.address_ciphertext, customer.address_key_version) : null,
      created_at: customer.created_at
    }));
  });

  app.post("/api/customers", {
    preHandler: [authenticate, authorize("ADMIN", "TECHNICIAN")],
    schema: { body: customerBody }
  }, async (request, reply) => {
    const body = request.body as {
      name: string; phone: string; address?: string; email?: string; password?: string;
    };
    if (Boolean(body.email) !== Boolean(body.password)) {
      return reply.code(400).send({ error: "Portal email and initial password must be provided together" });
    }
    const name = encrypt(body.name.trim());
    const phone = encrypt(body.phone.trim());
    const address = body.address?.trim() ? encrypt(body.address.trim()) : null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let userId: string | null = null;
      if (body.email && body.password) {
        const account = await client.query<{ id: string }>(
          `INSERT INTO users (id, email, password_hash, role)
           VALUES ($1, $2, $3, 'CUSTOMER') RETURNING id`,
          [randomUUID(), body.email.trim(), await argon2.hash(body.password, { type: argon2.argon2id })]
        );
        userId = account.rows[0]!.id;
      }
      const customerId = randomUUID();
      await client.query(
        `INSERT INTO customers
         (id, user_id, name_ciphertext, name_key_version, phone_ciphertext,
          phone_key_version, address_ciphertext, address_key_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [customerId, userId, name.ciphertext, name.keyVersion, phone.ciphertext, phone.keyVersion,
          address?.ciphertext ?? null, address?.keyVersion ?? null]
      );
      await client.query("COMMIT");
      return reply.code(201).send({ id: customerId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.get("/api/inventory", {
    preHandler: [authenticate, authorize("ADMIN", "TECHNICIAN")]
  }, async () => {
    const result = await pool.query(
      `SELECT id, sku, name, quantity_on_hand, unit_price, is_active, updated_at
       FROM inventory WHERE is_active = TRUE ORDER BY name LIMIT 1000`
    );
    return result.rows.map((item) => ({ ...item, unit_price: Number(item.unit_price) }));
  });

  app.post("/api/inventory", {
    preHandler: [authenticate, authorize("ADMIN")],
    schema: { body: inventoryBody }
  }, async (request, reply) => {
    const body = request.body as {
      sku: string; name: string; quantity_on_hand: number; unit_price: number;
    };
    const result = await pool.query(
      `INSERT INTO inventory (id, sku, name, quantity_on_hand, unit_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sku, name, quantity_on_hand, unit_price`,
      [randomUUID(), body.sku.trim(), body.name.trim(), body.quantity_on_hand, body.unit_price]
    );
    const row = result.rows[0]!;
    return reply.code(201).send({ ...row, unit_price: Number(row.unit_price) });
  });

  app.patch("/api/inventory/:id", {
    preHandler: [authenticate, authorize("ADMIN")],
    schema: {
      params: Type.Object({ id: uuid }),
      body: Type.Partial(inventoryBody)
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      sku: string; name: string; quantity_on_hand: number; unit_price: number;
    }>;
    const result = await pool.query(
      `UPDATE inventory
       SET sku = COALESCE($2, sku), name = COALESCE($3, name),
           quantity_on_hand = COALESCE($4, quantity_on_hand),
           unit_price = COALESCE($5, unit_price), updated_at = now()
       WHERE id = $1 AND is_active = TRUE
       RETURNING id, sku, name, quantity_on_hand, unit_price`,
      [id, body.sku?.trim() ?? null, body.name?.trim() ?? null,
        body.quantity_on_hand ?? null, body.unit_price ?? null]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Inventory item not found" });
    const row = result.rows[0]!;
    return { ...row, unit_price: Number(row.unit_price) };
  });

  app.get("/api/tickets", { preHandler: authenticate }, async (request) => {
    const customerId = request.user.role === "CUSTOMER"
      ? await customerIdForUser(request.user.id)
      : null;
    if (request.user.role === "CUSTOMER" && !customerId) return [];
    const result = await pool.query<TicketRow>(
      `SELECT t.*, c.name_ciphertext AS customer_name_ciphertext,
              c.name_key_version AS customer_name_key_version,
              c.phone_ciphertext AS customer_phone_ciphertext,
              c.phone_key_version AS customer_phone_key_version,
              u.email AS assigned_email
       FROM tickets t
       JOIN customers c ON c.id = t.customer_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE ($1::uuid IS NULL OR t.customer_id = $1)
         AND ($2::uuid IS NULL OR t.assigned_to = $2
              OR (t.assigned_to IS NULL AND t.status = 'OPEN'))
       ORDER BY t.created_at DESC LIMIT 500`,
      [customerId, request.user.role === "TECHNICIAN" ? request.user.id : null]
    );
    return result.rows.map(presentTicket);
  });

  app.post("/api/tickets", {
    preHandler: authenticate,
    schema: { body: ticketBody }
  }, async (request, reply) => {
    const body = request.body as {
      customer_id?: string; device_type: string; serial_number?: string;
      issue_description: string; estimated_cost?: number;
    };
    const customerId = request.user.role === "CUSTOMER"
      ? await customerIdForUser(request.user.id)
      : body.customer_id;
    if (!customerId) return reply.code(400).send({ error: "A valid customer is required" });
    const serial = body.serial_number?.trim() ? encrypt(body.serial_number.trim()) : null;
    const id = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const customer = await client.query("SELECT id FROM customers WHERE id = $1", [customerId]);
      if (!customer.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Customer not found" });
      }
      await client.query(
        `INSERT INTO tickets
         (id, customer_id, created_by, device_type, serial_number_ciphertext,
          serial_number_key_version, issue_description, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, customerId, request.user.id, body.device_type.trim(),
          serial?.ciphertext ?? null, serial?.keyVersion ?? null,
          body.issue_description.trim(),
          request.user.role === "CUSTOMER" ? null : body.estimated_cost ?? null]
      );
      await insertHistory(client, id, null, "OPEN", request.user.id);
      await client.query("COMMIT");
      await broadcastTicket(request.server.io, id, "OPEN", request.log);
      return reply.code(201).send({ id, status: "OPEN" });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/api/tickets/:id/claim", {
    preHandler: [authenticate, authorize("ADMIN", "TECHNICIAN")],
    schema: { params: Type.Object({ id: uuid }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE tickets
         SET assigned_to = $2, status = 'IN_PROGRESS', version = version + 1, updated_at = now()
         WHERE id = $1 AND assigned_to IS NULL AND status = 'OPEN'
         RETURNING id`,
        [id, request.user.id]
      );
      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "Ticket is no longer available to claim" });
      }
      await insertHistory(client, id, "OPEN", "IN_PROGRESS", request.user.id);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await broadcastTicket(request.server.io, id, "IN_PROGRESS", request.log);
    return { id, status: "IN_PROGRESS", assigned_to: request.user.id };
  });

  app.patch("/api/tickets/:id/status", {
    preHandler: [authenticate, authorize("ADMIN", "TECHNICIAN")],
    schema: {
      params: Type.Object({ id: uuid }),
      body: Type.Object({
        status: Type.Union(ticketStatuses.map((status) => Type.Literal(status))),
        version: Type.Integer({ minimum: 1 })
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, version } = request.body as { status: (typeof ticketStatuses)[number]; version: number };
    const allowed: Record<string, string[]> = {
      OPEN: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["WAITING_FOR_PARTS", "CANCELLED"],
      WAITING_FOR_PARTS: ["IN_PROGRESS", "CANCELLED"],
      READY_FOR_PICKUP: ["PICKED_UP"],
      PICKED_UP: [],
      CANCELLED: []
    };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ status: string; version: number; assigned_to: string | null }>(
        "SELECT status, version, assigned_to FROM tickets WHERE id = $1 FOR UPDATE",
        [id]
      );
      const row = current.rows[0];
      if (!row || row.version !== version ||
          (request.user.role !== "ADMIN" && row.assigned_to !== request.user.id) ||
          !(allowed[row.status] ?? []).includes(status)) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "Ticket changed or transition is not allowed" });
      }
      await client.query(
        "UPDATE tickets SET status = $2, version = version + 1, updated_at = now() WHERE id = $1",
        [id, status]
      );
      await insertHistory(client, id, row.status, status, request.user.id);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await broadcastTicket(request.server.io, id, status, request.log);
    return { id, status };
  });

  app.post("/api/tickets/:id/complete", {
    preHandler: [authenticate, authorize("ADMIN", "TECHNICIAN")],
    schema: {
      params: Type.Object({ id: uuid }),
      body: completeBody
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      parts: { inventory_id: string; quantity: number }[];
      labor: number; tax: number; currency: string;
    };
    if (new Set(body.parts.map((part) => part.inventory_id)).size !== body.parts.length) {
      return reply.code(400).send({ error: "Each inventory item may only appear once" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ticket = await client.query<{ status: string; assigned_to: string | null }>(
        "SELECT status, assigned_to FROM tickets WHERE id = $1 FOR UPDATE",
        [id]
      );
      const row = ticket.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Ticket not found" });
      }
      if (row.status !== "IN_PROGRESS" && row.status !== "WAITING_FOR_PARTS") {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "Only active tickets can be completed" });
      }
      if (request.user.role !== "ADMIN" && row.assigned_to !== request.user.id) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ error: "Ticket is assigned to another technician" });
      }

      let subtotalCents = Math.round(body.labor * 100);
      const taxCents = Math.round(body.tax * 100);
      for (const part of [...body.parts].sort((a, b) => a.inventory_id.localeCompare(b.inventory_id))) {
        const inventory = await client.query<{ unit_price: string; quantity_on_hand: number }>(
          "SELECT unit_price, quantity_on_hand FROM inventory WHERE id = $1 AND is_active = TRUE FOR UPDATE",
          [part.inventory_id]
        );
        const item = inventory.rows[0];
        if (!item || item.quantity_on_hand < part.quantity) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ error: "One or more parts are unavailable in the requested quantity" });
        }
        await client.query(
          "UPDATE inventory SET quantity_on_hand = quantity_on_hand - $2, updated_at = now() WHERE id = $1",
          [part.inventory_id, part.quantity]
        );
        await client.query(
          `INSERT INTO ticket_parts (ticket_id, inventory_id, quantity, unit_price_at_use)
           VALUES ($1, $2, $3, $4)`,
          [id, part.inventory_id, part.quantity, item.unit_price]
        );
        subtotalCents += Math.round(Number(item.unit_price) * 100) * part.quantity;
      }
      const amount = (cents: number) => (cents / 100).toFixed(2);
      const subtotal = amount(subtotalCents);
      const total = amount(subtotalCents + taxCents);
      await client.query(
        `INSERT INTO invoices (id, ticket_id, subtotal, tax, total, currency, issued_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), id, subtotal, amount(taxCents), total, body.currency, request.user.id]
      );
      await client.query(
        `UPDATE tickets SET status = 'READY_FOR_PICKUP', version = version + 1, updated_at = now()
         WHERE id = $1`,
        [id]
      );
      await insertHistory(client, id, row.status, "READY_FOR_PICKUP", request.user.id);
      await client.query("COMMIT");
      await broadcastTicket(request.server.io, id, "READY_FOR_PICKUP", request.log);
      let notificationQueued = false;
      try {
        await jobs.add("ticket-ready", { ticketId: id }, {
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 1000,
          removeOnFail: 5000
        });
        notificationQueued = true;
      } catch (error) {
        request.log.error({ err: error, ticketId: id }, "Could not enqueue ticket-ready job");
      }
      return {
        id, status: "READY_FOR_PICKUP", subtotal: Number(subtotal),
        tax: Number(amount(taxCents)), total: Number(total), currency: body.currency,
        notification_queued: notificationQueued
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

declare module "fastify" {
  interface FastifyInstance {
    io?: import("socket.io").Server;
  }
}
