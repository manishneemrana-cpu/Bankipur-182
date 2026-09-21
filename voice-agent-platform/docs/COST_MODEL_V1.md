# Cost Model v1 — Per-Connected-Minute Economics

**This is a Phase 0 modeling exercise, not a quote.** Every line item is built from the pricing recorded in `VERIFICATION.md` on 2026-09-21, several of which are third-party estimates (Exotel, and partially Plivo's India base voice rate, which this session could not fetch directly — see VERIFICATION.md §7). All figures assume **₹88 = $1** (approximate Sep-2026 rate) and must be re-priced against live vendor quotes before any commercial commitment is made.

**₹1/min is stated in the founder's spec as a target for the Economy tier only, under the specific assumptions below. It is NOT a guarantee, and the verified pricing gathered in this session puts the realistic Economy-tier floor closer to ~₹2/min unless telephony is renegotiated to high-volume/direct-SIP rates.** Telephony is the dominant cost line in both tiers — it, not the AI stack, is the main lever on whether ₹1/min is reachable.

---

## Assumptions (stated explicitly so the numbers are auditable)

| Assumption | Value |
|---|---|
| Exchange rate | ₹88 / $1 |
| Average connected call length | 3 minutes |
| Average conversational turns per connected minute | 2 |
| Average LLM input tokens per turn (system+history+user utterance) | ~200 tokens |
| Average LLM output tokens per turn (agent reply) | ~80 tokens |
| Average TTS characters synthesized per turn (agent reply) | ~60–80 characters (short, natural turns — not long monologues) |
| STT | transcribes the full connected-minute duration (continuous streaming, not just agent turns) |
| Infra allocation | amortized compute/hosting/observability/on-call/support cost per connected minute (rough allocation, not a detailed infra BOM) |
| Telephony base voice rate (Economy) | ₹0.60/min — **low end of third-party India benchmark, NOT a confirmed Plivo/Exotel quote** (see VERIFICATION.md §1, §7) |
| Telephony base voice rate (Premium) | ₹1.20/min — mid/high-end benchmark, assumes toll-free/BFSI-grade routing or Exotel |
| Telephony streaming add-on | Plivo's published $0.004/min (~₹0.35/min) applied to both tiers, since bidirectional media streaming is required for either tier's real-time pipeline |

---

## Economy tier: Sarvam STT + Sarvam Bulbul TTS + Gemini Flash-Lite + Plivo

| Cost line | Basis | ₹/connected-minute |
|---|---|---|
| Telephony (voice + streaming) | ₹0.60 base + ₹0.35 streaming add-on | **₹0.95** |
| STT (Sarvam, no diarization) | ₹30/hr = ₹0.50/min | **₹0.50** |
| TTS (Sarvam Bulbul) | 2 turns × 70 chars = 140 chars/min × ₹0.003/char (₹30/10,000 chars) | **₹0.42** |
| LLM (Gemini 2.5 Flash-Lite)* | 400 input tok × $0.10/M + 160 output tok × $0.40/M = $0.000104/min | **₹0.01** |
| Infra allocation (Economy) | rough amortized estimate | **₹0.15** |
| **Total — Economy** | | **≈ ₹2.03/min** |

\* Gemini 2.5 Flash-Lite is scheduled for retirement on 2026-10-16 — re-price against its successor model before committing (VERIFICATION.md §4.1).

**To approach the ₹1/min target**, the model shows two levers matter most: (1) telephony — a negotiated high-volume or direct-SIP rate materially below the ₹0.60 assumed here, and (2) shorter/optimized STT-TTS usage (e.g., only transcribing/synthesizing active speech via VAD rather than full-duration streaming, batching, or a self-hosted Piper/faster-whisper stack once volume justifies the ops overhead). Neither lever is verified as achievable in this session — they are the explicit list of things Phase 1 must confirm before ₹1/min is quoted to any customer.

---

## Premium tier: Deepgram STT + Cartesia TTS + Gemini Flash + Plivo/Exotel

| Cost line | Basis | ₹/connected-minute |
|---|---|---|
| Telephony (voice + streaming) | ₹1.20 base + ₹0.35 streaming add-on | **₹1.55** |
| STT (Deepgram Nova-3, streaming) | $0.0077/min | **₹0.68** |
| TTS (Cartesia, per-character, mid-range plan) | 2 turns × 80 chars = 160 chars/min at ~$15/M chars (mid of $5–$37/M range) | **₹0.21** |
| LLM (Gemini 2.5 Flash)* | 400 input tok × $0.30/M + 160 output tok × $2.50/M = $0.00052/min | **₹0.05** |
| Infra allocation (Premium) | higher redundancy/observability | **₹0.30** |
| **Total — Premium** | | **≈ ₹2.79/min** |

\* Same Gemini deprecation caveat as above applies.

A further "flagship" option swaps Cartesia for ElevenLabs (~₹0.70/min TTS at this turn volume, using the Flash/Turbo model rate) for the highest perceived voice quality, pushing Premium to roughly ₹3.3/min.

---

## Why the two tiers are closer together than "Economy vs Premium" branding suggests

Telephony (~45–55% of the total) is the largest single line in **both** tiers, and this model uses the same streaming add-on and a similar base-rate spread for both. This is intentional and important for the founder to see: the STT/TTS/LLM choice mostly changes the AI-stack line (roughly ₹1.08/min Economy vs ₹0.94/min Premium in this model — Premium's AI stack is not even much pricier because Deepgram/Cartesia/Gemini-Flash are all inexpensive per-unit; the real quality delta is latency and voice naturalness, not linear cost), while telephony pricing (which neither this session nor the public web fully confirmed) is the biggest unresolved variable in the whole model.

---

## Volume simulator (cost only, no margin/pricing-to-customer layered in)

| Minutes/month | Economy (≈₹2.03/min) | Premium (≈₹2.79/min) |
|---:|---:|---:|
| 100 | ₹203 | ₹279 |
| 1,000 | ₹2,030 | ₹2,790 |
| 10,000 | ₹20,300 | ₹27,900 |
| 100,000 | ₹2,03,000 | ₹2,79,000 |

These are linear extrapolations of the per-minute model above; they do **not** include volume-discount tiers that Plivo/Exotel/Sarvam/Deepgram/Groq/Google typically offer at higher commitment levels (e.g., Sarvam's Pro/Business monthly plans, Deepgram's Growth annual-prepaid rate, or a negotiated telephony SIP contract) — at 100,000 min/month, all of those discounts would likely apply and should be re-modeled with actual negotiated rates, not the retail/PAYG rates used here.

## What Phase 1 must confirm before this model is trusted for pricing customers

1. Actual Plivo/Exotel India per-minute quotes at the founder's expected volume (see VERIFICATION.md §7.1–7.2).
2. Whether Sarvam's Business tier (₹50,000/mo, 1,000 req/min) changes the effective per-minute STT/TTS cost at scale vs. the PAYG rate used here.
3. Gemini's post-October-2026 successor model and its price.
4. Real measured average call length, turns/min, and character/token counts from a pilot — the assumptions above are reasoned estimates, not measured data.
