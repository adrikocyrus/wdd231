# Benchflow — Computer Repair Management System

A self-hosted full-stack CRMS starter with a responsive Next.js workbench, a
Fastify REST API, PostgreSQL, Redis, Socket.IO updates, and a BullMQ worker.
Everything is isolated in this folder; the existing WDD231 coursework site is
unchanged.

## Open the interactive website demo

To preview the design without installing anything, open `demo.html` in a
browser. From the repository root in PowerShell:

```powershell
Start-Process .\crms\demo.html
```

This standalone browser prototype includes sample tickets, customers,
inventory, invoices, and staff. You can create records, assign and progress
tickets, complete a repair and issue an invoice, and restock parts. Demo changes
are saved in this browser's local storage; use **Reset sample data** to restore
the original examples. The demo does not connect to the API, authenticate
users, encrypt data, or provide production security. Do not enter real customer
information. Use the Docker instructions below to run the full-stack app.

## Included

- Staff and customer sign-in with short-lived, HttpOnly JWT cookies, role checks,
  password hashing, and an authenticated password-change page.
- Ticket and customer management, ticket assignment and status history,
  inventory, invoices, and a responsive dashboard.
- Customer self-service tickets and invoices, restricted to the signed-in
  customer's linked customer record.
- AES-256-GCM encryption for customer name, phone, address, and device serial
  fields. The API requires a 32-byte encryption key supplied as an environment
  secret; it is not stored in PostgreSQL.
- PostgreSQL constraints and foreign keys. Completing a repair locks the
  ticket and inventory rows, decrements parts, writes the invoice, updates the
  ticket, and records status history in one transaction.
- Optimistic ticket versions, atomic ticket claiming, payload validation,
  rate-limited sign-in, security headers, and Redis-backed Socket.IO scaling.
- A Redis/BullMQ worker for post-completion jobs.

## Run locally with Docker Compose

You need Docker Desktop with Compose enabled. From PowerShell:

```powershell
Set-Location crms
Copy-Item .env.example .env
```

Edit `.env` and replace every placeholder with unique, randomly generated
secrets. `CRMS_ENCRYPTION_KEY` must be base64 encoding exactly 32 random bytes;
`JWT_SECRET` must be at least 32 characters. Use URL-safe values for database
and Redis passwords. Do not commit `.env` or reuse development secrets in
production.

Start the services:

```powershell
docker compose up --build -d
```

The first API start applies the database migration. Create the first
administrator explicitly; no default or seeded password is created:

```powershell
docker compose run --rm `
  -e BOOTSTRAP_ADMIN_EMAIL=admin@example.com `
  -e BOOTSTRAP_ADMIN_PASSWORD='use-a-unique-password-of-at-least-12-characters' `
  api node dist/scripts/create-admin.js
```

Open [http://localhost:3000](http://localhost:3000). The API health check is at
[http://localhost:4000/health](http://localhost:4000/health). Sign in with the
administrator account, then create technicians, customers, and inventory in the
workbench. A customer portal account can be created with a customer record by
providing its email and a unique initial password.

Stop the local services with `docker compose down`. Persistent PostgreSQL and
Redis data remain in named volumes; `docker compose down -v` deletes those
volumes and their data.

## Local development without containers

Install Node.js 24+, PostgreSQL 16+, and Redis 7+. Copy `.env.example` to `.env`
and configure URLs for local services. Start PostgreSQL and Redis, apply the
migration from this directory, then run each service:

```powershell
Set-Location crms
npm --prefix api install
npm --prefix frontend install
npm --prefix api run db:migrate
npm --prefix api run dev
```

In separate terminals run `npm --prefix api run worker` and
`npm --prefix frontend run dev`. Create the first administrator with
`BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` set in the environment,
then run `npm --prefix api run seed:admin`:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@example.com"
$env:BOOTSTRAP_ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
npm --prefix api run seed:admin
```

## Project layout

```text
crms/
  api/                 Fastify API, auth, validation, workers, migrations
  database/            PostgreSQL schema migrations
  frontend/            Next.js dashboard and responsive styles
  infra/               Reverse-proxy example for production TLS termination
  docker-compose.yml   Local PostgreSQL, Redis, API, worker, and web services
```

## Deploy to a Linux VPS

The Compose services publish the web and API ports to loopback only;
PostgreSQL and Redis are not published. Put a TLS reverse proxy on the host and
allow only SSH, HTTP, and HTTPS through the server firewall. Caddy is the
simplest choice here because it provisions and renews HTTPS certificates.

1. Create a Linux VPS, point your domain's DNS A/AAAA records at it, and allow
   inbound ports 22, 80, and 443. Install Docker Engine with the Compose plugin
   and install Caddy on the host using the
   [official installation instructions](https://caddyserver.com/docs/install).
2. Copy the `crms` directory to the server and create its `.env` file. Generate
   new secrets on the server; do not reuse sample or development values. Set
   restrictive permissions on the environment file (`chmod 600 .env`):

   ```sh
   openssl rand -hex 32
   openssl rand -hex 32
   openssl rand -hex 32
   openssl rand -base64 48
   openssl rand -base64 32
   ```

   For a new database, use the first three outputs for `DB_ADMIN_PASSWORD`,
   `DB_APP_PASSWORD`, and `REDIS_PASSWORD`; use the fourth for `JWT_SECRET` and
   the fifth for `CRMS_ENCRYPTION_KEY`. Set `NODE_ENV=production`,
   `COOKIE_SECURE=true`, `FRONTEND_ORIGIN=https://crms.example.com`, and
   `NEXT_PUBLIC_API_URL=https://crms.example.com` in `.env`. Keep a separate,
   access-controlled backup of the encryption key. Do not commit `.env`.
   When migrating an existing PostgreSQL volume, keep the current `crms`
   database password as `DB_ADMIN_PASSWORD` instead of using the first new
   output; changing the environment value alone does not change the password
   stored by PostgreSQL.
3. Copy `infra/Caddyfile.example` to the host's Caddy configuration path and
   replace `crms.example.com` with your domain. Its site address must match
   `FRONTEND_ORIGIN` and `NEXT_PUBLIC_API_URL`. The proxy sends `/api`,
   `/health`, and `/socket.io` to the API, while all other requests go to
   Next.js; Caddy handles HTTPS and WebSocket upgrades.
4. On the server, start the app and create the first administrator:

   ```sh
   cd crms
   docker compose up -d postgres
   docker compose exec -T postgres \
     psql -U crms -d crms -v ON_ERROR_STOP=1 \
     -f /docker-entrypoint-initdb.d/001-app-role.sql
   docker compose up --build -d
   docker compose ps
   docker compose run --rm \
     -e BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
     -e BOOTSTRAP_ADMIN_PASSWORD='use-a-unique-password-of-at-least-12-characters' \
     api node dist/scripts/create-admin.js
   ```

   Run the administrator-creation command once with a unique password. Open
   `https://crms.example.com` and verify the browser shows a valid HTTPS
   certificate. PostgreSQL's `crms` account is reserved for administration
   and backups; the app connects as the non-superuser `crms_app` role.
   The role/privilege update is safe to rerun, works for fresh and existing
   database volumes, and preserves data. For an existing volume, keep the
   current `crms` database password in `DB_ADMIN_PASSWORD`. Never run
   `docker compose down -v` as part of setup or upgrades.
5. Configure daily backups and test restoring them on a separate staging
   database before entering real customer data. `sh ops/backup.sh` creates a
   permission-restricted custom-format PostgreSQL dump and keeps 14 days of
   local dumps by default. Set `BACKUP_RETENTION_DAYS` to change local
   retention. Configure an `rclone`
   remote and set `BACKUP_REMOTE` to copy dumps off-site. Set a default
   retention lock on the destination bucket. Database dumps alone cannot
   decrypt customer fields, so back up `CRMS_ENCRYPTION_KEY` separately.

For a simple daily schedule, configure `BACKUP_REMOTE` in the crontab
environment and add a cron entry such as:

```cron
0 2 * * * /opt/crms/ops/backup.sh >> /var/log/crms-backup.log 2>&1
```

Replace `/opt/crms` with the actual installation path and ensure the cron
user can access Docker, the Compose project, and its configured `rclone`
remote. Monitor backup logs and periodically perform a restore test.

`FRONTEND_ORIGIN` is used by the API and `NEXT_PUBLIC_API_URL` is embedded
when the frontend image builds. Rebuild the frontend after changing its URL:
`docker compose build frontend && docker compose up -d frontend`.
The loopback port bindings allow a host reverse proxy to reach the app without
exposing the API directly to the internet.

The [Nginx example](./infra/nginx.conf.example) is an alternative host proxy;
configure its TLS certificates before enabling it. Do not run Nginx and Caddy
on the same public ports.

### Restore a backup

First practice on a separate staging instance. Restore a custom-format dump
into an empty database with:

```sh
docker compose exec -T postgres \
  pg_restore --no-owner -U crms -d crms < /path/to/crms-backup.dump
```

Restoring over an existing database can overwrite data; take and verify a
separate backup before any production restore.

### Deploy updates

Keep `.env` and the PostgreSQL/Redis volumes. Review the release, back up the
database, then rebuild and restart:

```sh
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 api frontend worker
```

Migrations run during API startup. Test application upgrades and restores on
staging before applying them to production.

## Production integrations still required

The `ticket-ready` worker currently records a queued job; it does not deliver
SMS or email. Invoice PDF generation, payment processing, provider-specific
notification delivery, and monitoring/alerting need integrations with the
services your business chooses. The backup script creates daily full logical
PostgreSQL dumps; it does not configure point-in-time recovery or object-lock
policies. Configure off-site retention, restore drills, server monitoring, and
incident response before storing sensitive customer or business data.

The encryption key version is stored beside encrypted values. The current
implementation supports key version 1; key rotation and re-encryption need an
operational migration before replacing that key. Protect and back up the
encryption key separately from database backups.
