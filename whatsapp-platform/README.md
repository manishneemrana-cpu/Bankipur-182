# WhatsApp Business Platform (white-label, multi-tenant)

Phase 1 scaffold: architecture, database schema with Row-Level Security tenant isolation,
auth, and tenant/role system. See `docs/FOUNDER_SETUP.md` first if you're non-technical,
or `docs/architecture.md` / `docs/database.md` for the technical design.

## Quick start (local development)

```bash
cp .env.example .env    # fill in local values
npm install
npm run migrate         # applies schema + creates the unprivileged runtime DB role
npm run dev
```

## Quality gates

```bash
npm run typecheck
npm run lint
npm run build
npm test                 # requires a running Postgres — see docs/database.md
```

## Deploying

See `docs/deployment-vps.md` for a self-hosted Hostinger VPS deployment with Docker.

## Status

Phase 1 of 13 (see the project brief's build order). No Meta/WhatsApp integration yet —
`MOCK_META=true` is required and enforced by `src/server/env.ts`.
