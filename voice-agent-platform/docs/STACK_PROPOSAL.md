# Stack Proposal — Phase 0

This proposes a primary + alternate adapter per component, following the spec's rule: **never hard-code a provider — every external dependency sits behind a provider-agnostic adapter interface** so a tenant/reseller can be reconfigured to a different vendor without a code change to the core pipeline.

The user-sketched table is verified/updated below against current findings (see `VERIFICATION.md`).

| Layer | Primary | Alternate(s) | Notes / what changed vs. the original sketch |
|---|---|---|---|
| Telephony | **Plivo** (India) | Exotel | Both confirmed to support bidirectional WebSocket media streaming (needed for real-time voice). Plivo publishes its streaming add-on cost ($0.004/min); Exotel does not publish pricing at all (sales-quote only) — a real operational risk for a self-serve reseller model. Recommend keeping Plivo primary but getting an Exotel quote before Phase 1 in case DLT/DND tooling or India-market relationship favors Exotel. |
| STT | **Sarvam STT** (Saaras, successor to Saarika) | Deepgram (Nova-3), Groq-hosted Whisper large-v3-turbo | Confirm the Saarika→Saaras v3 migration at integration time — Saarika v2.5 is being deprecated. Groq Whisper is the cheapest raw $/min found but is better suited to fast batch/near-real-time transcription than a live low-latency socket; keep as a cost-optimization fallback, not a live-turn default. |
| TTS | **Sarvam Bulbul** (v3) | Cartesia (Sonic-3/Turbo), ElevenLabs, Piper (self-hosted) | Bulbul remains cheapest + best Indian-language coverage with confirmed streaming. Cartesia added as the **low-latency Premium alternate** (40–90ms time-to-first-audio) for English-heavy or latency-critical flows. ElevenLabs is the quality ceiling at the highest cost — reserve for flagship/high-value calls only. Piper is a viable Economy self-hosted fallback but its **engine relicensed to GPL-3.0 in Oct 2025** (was MIT) — flag for legal review before shipping (see COMPLIANCE.md/VERIFICATION.md). |
| LLM | **Gemini Flash-Lite/Flash** | Groq Llama 3.1-8B-Instant | Both current Gemini 2.5 Flash-Lite and 2.5 Flash are **scheduled for deprecation on 2026-10-16** — re-verify the successor model/price before Phase 1 build. Groq's Llama 3.3-70B moved to enterprise-only pricing on 2026-08-26 and is no longer a self-serve alternate for cost modeling; Llama 3.1-8B-Instant remains self-serve and is documented here as the practical alternate. |
| Orchestration framework | **Pipecat** | LiveKit Agents | Pipecat's transport-agnostic pipeline plus existing first-party Plivo and Exotel integrations map directly onto the adapter-interface requirement. LiveKit Agents is the alternate for if/when the platform needs LiveKit's own WebRTC/SIP infra at larger concurrent-call scale. |
| Database | **PostgreSQL + pgvector** | — (spec-mandated, not a swappable adapter) | Stores tenant/call/transcript/CRM data plus vector embeddings for RAG-style knowledge lookups (property listings, FAQs) the agent can call as a tool. |
| Cache / Queue | **Redis** | — (spec-mandated) | Session state for in-flight calls, rate limiting, pub/sub between the voice gateway and orchestrator, and a queue for outbound-call jobs. |

## Adapter interface principle

Each of Telephony, STT, TTS, and LLM must be implemented as a small internal interface, e.g.:

- `TelephonyAdapter`: `place_call()`, `answer_call()`, `open_media_stream()`, `hangup()`, `send_dtmf()` — implemented once per provider (Plivo, Exotel, …).
- `STTAdapter`: `stream_audio_chunk() -> partial/final transcript events`.
- `TTSAdapter`: `synthesize_stream(text) -> audio chunks`.
- `LLMAdapter`: `generate(messages, tools) -> streamed tokens / tool calls`.

Per-tenant (and per-reseller white-label) configuration selects which concrete adapter to instantiate for each layer, so a reseller could, for example, run Economy tier on Sarvam+Gemini+Plivo while a Premium tenant runs Cartesia+Gemini Flash+Plivo, with zero core-pipeline code changes — only config.

## Why Pipecat over LiveKit Agents (summary; full detail in VERIFICATION.md)

- Confirmed first-party Pipecat serializers/transports for **both** Plivo and Exotel already exist, which is a direct, low-risk path to the two India telephony providers this spec requires.
- Pipecat's frame-processor pipeline model gives fine-grained control over barge-in behavior and per-stage provider swapping — matching the adapter-interface requirement more naturally than LiveKit Agents, which is architected around LiveKit's own WebRTC server.
- Python-first, open-source (no vendor lock to a hosted media server), consistent with running this as a separate Python service (see ARCHITECTURE.md).
- LiveKit Agents remains the documented alternate for a future point where the platform needs LiveKit's own SIP-trunking/WebRTC infrastructure at a much larger concurrent-call scale than Phase 1 targets.
