# Start here (plain-language guide)

This document explains, in plain language, what has been built so far, what it means for
you, and what you personally need to go do outside of this coding session.

## What "Phase 1" means

Think of this like building a house. Phase 1 is the foundation, plumbing, and electrical
wiring — nothing you can see yet (no WhatsApp messaging, no client dashboard with real
features), but the part that has to be correct before anything else is built on top of it.
Specifically, Phase 1 built:

1. **The database** — every piece of information the platform will ever store (your clients'
   organizations, their team members, their contacts, conversations, message templates,
   billing, etc.) — designed so that **one client can never see another client's data**, even
   by accident, even if there's a bug in a future feature. This is enforced by the database
   itself (a feature called Row-Level Security), not just by careful coding — which is the
   safest way to build a system meant to be resold to multiple companies.
2. **Sign-up and login** — a company can register, and its first user automatically becomes
   the "Owner" of that company's account.
3. **Automated proof that isolation works** — a set of tests that literally try to break in
   (read another company's data, sneak in a fake company ID, etc.) and confirm every attempt
   fails. These ran against a real database, not a simulation, and currently all pass.

## What does NOT exist yet

- No real WhatsApp sending/receiving. No Meta/Facebook connection at all yet.
- No shared inbox, no contacts/CRM screens, no campaigns, no billing.
- The dashboard and admin pages are placeholders — they exist and are protected by login,
  but there's nothing to do on them yet.

## What you personally need to do before we go further

**Nothing urgent yet.** The next few things you'll eventually need to do (in later phases,
not now) are:

1. **Point your domain at your VPS.** When you're ready to put this live at
   `www.manishpandey.in`, you (or whoever manages your Hostinger DNS) need to set that
   domain's "A record" to your VPS's IP address. Ask me when you're ready and I'll walk you
   through exactly where to click in Hostinger's panel.
2. **Have your Hostinger VPS login ready** (the SSH access details) for when we deploy.
3. Later (Phase 3, not yet) you'll need to create a free Meta Developer account and a Meta
   Business Portfolio — I'll give you exact click-by-click instructions when we get there.
   Do not create one early on your own, since Meta's setup steps change and I want to base
   the instructions on their current screens, not an old tutorial.

## Words you'll see and what they mean

- **Tenant / Organization** — one client company using the platform (could be your own
  business, "Magadh Property," or a builder/broker you resell this to later).
- **RLS (Row-Level Security)** — the database-level lock that keeps one tenant's data away
  from another tenant, automatically, all the time.
- **MOCK_META** — a safety switch. While it's on (which it is right now), the platform will
  never send a real WhatsApp message or contact Meta's servers, even if someone clicks a
  button that looks like it does. It has to be deliberately turned off later, and only once
  real Meta credentials exist.

## How to check the platform is alive

Once deployed, visiting `https://www.manishpandey.in/api/health` should show a small message
saying the database is connected. This doesn't mean features are ready — just that the
underlying plumbing is running.

## What's next

Phase 2 (customer dashboard shell + admin dashboard shell + mock mode) is the next planned
step, per the build order. I will not start it until you say "go."
