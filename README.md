# Warehouse Now — Team Review & Task Monitoring Platform

An internal web app that revives the old "To-Do" app into a review-management platform.
Managers and members create categorized tasks, assign timelines, the system **auto-flags
criticality** on every read, and bottlenecks + corrective actions are captured for daily
monitoring and periodic reviews.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React (Vite) + TypeScript + Tailwind CSS (mobile-responsive) |
| Backend  | Node.js + Express + TypeScript (REST) |
| Database | PostgreSQL via Prisma |
| Auth     | Email + password, JWT sessions, role-based access |

Monorepo with npm workspaces: [`/server`](server) and [`/client`](client).

## Roles

- **Admin** — full access; manages all masters; sees & assigns every task.
- **Manager** — creates and assigns tasks to self or direct reports; sees own tasks plus the
  full downward reporting tree (collapsed to direct reports, double-click to drill in);
  approves/rejects end-date change requests for tasks they manage.
- **Member** — sees only own tasks; can mark Completed, fill remarks/bottleneck/corrective
  action, and request (not directly make) an end-date change.

## Status / criticality engine

Status is **computed server-side on every read** (no nightly job). Precedence:

1. `Completed` — owner marked it done (the only manual status).
2. `Dead` — `overdue_days >= dead_days` (default 25, all categories). Terminal.
3. Per the category's **delay profile**:
   - **relative** (thresholds are multiples of the task's duration; defaults 1.5× / 2.0×)
   - **absolute** (thresholds are fixed day-counts past the end date; defaults 3 / 5)
   - → `Critically Delayed` → `Delayed` → `At Risk` (any overdue) → `Ongoing`.

Thresholds and `dead_days` are stored **per category** and editable from the Masters screen.

Colors: Ongoing = green, At Risk = amber, Delayed = orange, Critically Delayed = red,
Dead = dark grey/black, Completed = blue.

## End-date governance

- `end_date` is **locked after creation**.
- To change it, the owner/creator submits a change request (new date + reason); it is **not**
  applied immediately.
- It routes to the owner's reporting manager (or an admin) via the **Approvals** queue.
- On approval: `end_date` updated, `end_date_change_count` incremented, audit logged, and the
  task shows a "Date changed ×N" badge. **Maximum 2 approved changes.**

## Local setup

Prerequisites: Node 20+, a running PostgreSQL instance.

```bash
# 1. Install all workspace deps
npm install

# 2. Configure environment
cp .env.example .env
#   - point DATABASE_URL at your local Postgres
#   - set JWT_SECRET and the SEED_ADMIN_* values
#   The server reads /.env; Vite reads VITE_* vars from the same file.

# 3. Create the schema + generate the Prisma client
npm --workspace server run migrate:dev   # first run creates the migration

# 4. Seed masters + the admin user
npm run seed

# 5. Run both apps (API :4000, client :5173)
npm run dev
```

Log in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set in `.env`.
Clients and Warehouses start empty — add them under **Masters** as an admin.

## Deploy to Render (Blueprint)

This repo ships a [`render.yaml`](render.yaml) blueprint that provisions a managed Postgres,
the API web service, and the static client.

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, point it at this repo.
3. Render creates `review-tool-db`, `review-tool-api`, and `review-tool-web`.
4. Fill the `sync: false` env vars when prompted:
   - **API** `SEED_ADMIN_PASSWORD`, and `CLIENT_ORIGIN` = the static site URL.
   - **Web** `VITE_API_BASE_URL` = the API service URL (e.g. `https://review-tool-api.onrender.com`).
   `DATABASE_URL` and `JWT_SECRET` are wired/generated automatically.
5. The API build runs `prisma migrate deploy` automatically. After the first deploy, run the
   seed once from the API service shell:
   ```bash
   npm run seed
   ```

## Project layout

```
/server
  prisma/schema.prisma     # data model
  src/statusEngine.ts      # the core status/criticality engine
  src/routes/*             # auth, masters, users, tasks, changeRequests, reports
  src/seed.ts              # Section 8 seed data
/client
  src/pages/*              # Login, Dashboard, TaskForm, TaskDetail, Masters, Approvals, Reports
  src/components/*         # TaskTable, TeamTree (drill-down reporting tree)
render.yaml                # Render blueprint
```

## Design choices & notes

- **Status is never stored** — always derived, so thresholds tune retroactively.
- **No archiving**: completed tasks remain; use the Completed status filter + date range on the
  Dashboard/Reports to review them.
- **Corrective fields** (Bottleneck, Corrective Action) become required when a task's computed
  status is Delayed, Critically Delayed, or Dead — enforced on both create and edit.
- **Date range filters** apply to the task's `end_date`.
- The reporting tree is walked recursively for manager visibility; the UI lazy-loads each level
  on double-click.
- **Auth tokens** are stored in `localStorage`; the client uses a hash router so the static host
  needs no server-side routing config (the blueprint also adds an SPA rewrite).
- Editing a task never changes `end_date` directly — that always goes through the approval flow.
