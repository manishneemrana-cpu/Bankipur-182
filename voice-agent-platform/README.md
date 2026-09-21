# SitesNSign AI Voice Sales Agent Platform

This directory holds **Phase 0 discovery and planning only** for a new, separate product: a production-grade, multi-tenant, white-label AI voice calling SaaS for Indian real estate builders/brokers, built on the founder's master specification.

**No application code exists here yet.** Per the spec, Phase 0's job is to verify current vendor pricing/capabilities, propose (but not lock in) a technology stack, model realistic per-minute costs, describe the target architecture, and flag compliance requirements — all subject to founder approval before Phase 1 writes any code.

This is entirely separate from the existing Next.js "SitesNSign AI Executive" app in the rest of this repository (`src/`) and does not modify it.

## Documents

- [`docs/PHASE0_SUMMARY.md`](docs/PHASE0_SUMMARY.md) — 10-line project understanding + blocking questions for the founder before Phase 1.
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — dated, sourced findings on telephony, STT, TTS, LLM, and orchestration-framework options.
- [`docs/STACK_PROPOSAL.md`](docs/STACK_PROPOSAL.md) — recommended primary + alternate adapter per layer, with reasoning.
- [`docs/COST_MODEL_V1.md`](docs/COST_MODEL_V1.md) — per-connected-minute cost breakdown for an Economy and a Premium tier, with explicit assumptions and a volume simulator.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — target system architecture, the n8n/real-time-audio boundary, and the repo/monorepo placement decision.
- [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) — TRAI/DLT/DND/TCCCPR summary for AI voice calling in India (not legal advice — requires professional review before go-live).
