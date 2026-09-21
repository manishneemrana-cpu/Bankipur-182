# Architecture (Phase 1)

## Stack

- **Next.js 16** (App Router), TypeScript (strict), Tailwind CSS.
- **PostgreSQL 16**, self-hosted via Docker on the VPS (not Supabase — see `decisions.md`).
- **Redis 7**, provisioned but unused until a bulk-sending job queue is needed.
- Deployed as a standalone Node server (`output: "standalone"` in `next.config.ts`) behind
  a reverse proxy (Caddy/Nginx) that terminates TLS for the real domain.

## Folder layout

```
whatsapp-platform/
├── src/
│   ├── app/                    # Next.js App Router routes
│   │   ├── page.tsx             # marketing/home stub
│   │   ├── login/, register/    # auth pages (server actions)
│   │   ├── dashboard/           # tenant-scoped app (stub)
│   │   ├── admin/               # platform-admin app (stub)
│   │   └── api/health/          # GET /api/health
│   └── server/                  # server-only code; never imported by client components
│       ├── env.ts               # validated environment access (Zod)
│       ├── db.ts                # pg Pool + RLS-scoped transaction helpers
│       ├── auth.ts              # session cookies, password hashing, org-context resolution
│       ├── permissions.ts       # OWNER/ADMIN/MANAGER/AGENT/VIEWER role -> permission map
│       └── actions/              # "use server" actions (register, login, logout)
├── migrations/
│   └── 0001_init.sql            # full schema + Row-Level Security policies
├── scripts/
│   └── migrate.ts               # applies migrations + provisions the unprivileged DB role
├── tests/
│   └── tenant-isolation.test.ts # runs against a real Postgres, not a mock
├── docker-compose.yml            # db + redis + app, for the VPS
├── Dockerfile
└── docs/
```

## Request flow and tenant isolation (the part that matters most)

1. A request arrives for a tenant-scoped action (e.g. "list my contacts").
2. The server reads the session cookie (`readSession()`), which yields only a `userId` —
   never an organization id.
3. `requireOrgContext(organizationId)` looks up `organization_members` to confirm this user
   actually belongs to that organization, and returns their role + permission overrides.
   The `organizationId` passed in here must itself come from something server-trusted (e.g.
   the authenticated user's own membership row, or a path segment that gets checked against
   that membership) — **never** taken as-is from a client-supplied field and trusted blind.
4. All actual data access runs inside `withOrgTransaction(organizationId, fn)`, which opens
   a Postgres transaction and runs `SELECT set_config('app.org_id', $1, true)` before `fn`
   executes. Every tenant table's Row-Level Security policy reads that same setting, so a
   query that "forgets" to filter by `organization_id` still can't see another tenant's rows
   — the database enforces it, not application code.
5. Platform-admin-only operations (e.g. creating the very first organization at signup) use
   `withPlatformAdminTransaction`, which is deliberately a separate, narrowly-scoped code
   path, not a flag you can pass to the normal one.

See `docs/database.md` for the full schema and RLS design, and `docs/decisions.md` for why
the app must connect as an unprivileged database role for any of this to actually work.

## What's NOT built yet

Meta/WhatsApp integration, the shared inbox, campaigns, the Compliance Guardian, billing,
the public API, and automation/AI/calling — all deferred to later phases per the build order
in the project brief. This phase is architecture, database, auth, and tenant isolation only.
