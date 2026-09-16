# SitesNSign AI Executive

AI Executive Command Center for SitesNSign Prop Tech Pvt. Ltd.

This is a **separate application** from the SitesNSign production website
(https://sitesnsign.com/). It never modifies that production site, its
source code, or its database. See `NON-NEGOTIABLE SAFETY RULES` in project
history for the full safety model (DEMO/TEST/LIVE modes, approval chain,
read-only connectors).

## Status

**Phase 1 complete**: project scaffold, database schema, and authentication.

- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui-style components
- Supabase project `sitesnsign-ai-executive` (separate from any SitesNSign
  production database) with:
  - `organizations` table (multi-tenant root; single org = SitesNSign today)
  - `profiles` table (1:1 with `auth.users`, role-scoped to an org)
  - `app_role` enum: `OWNER, ADMIN, EXECUTIVE, MANAGER, AGENT, ANALYST, VIEWER`
  - Row Level Security on every table; verified anon/cross-org isolation
  - Auto-provisioning trigger: new signups start unassigned (VIEWER, no org)
    until an OWNER/ADMIN assigns them — no assumptions about identity/role
- Supabase Auth wired up: `/login`, `/signup`, session-refresh proxy
  (`src/proxy.ts`, Next.js 16's middleware equivalent) that gates all routes
  except `/login`, `/signup`, `/auth/callback`

Upcoming phases (see master build spec): dashboard + demo data (Phase 2),
agent framework + Standard Agent Output Contract (Phase 3), two-stage
Worker → Head → CEO review chain + approvals + audit log (Phase 4), n8n
integration (Phase 5), SitesNSign read-only connector (Phase 6), social/CRM/
calling connectors as drafts only (Phase 7), gated live integrations
(Phase 8).

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL/anon key; service role stays local-only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

See `.env.example`. Secrets never go in frontend code or Git — `.env*` is
gitignored. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be
exposed to the client.
