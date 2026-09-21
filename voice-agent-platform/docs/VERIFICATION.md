# Verification Log — Phase 0

All findings below were gathered via live web search on **2026-09-21**. Pricing for AI APIs changes frequently (several vendors below changed pricing or deprecated models within the last few months) — treat every number here as a snapshot to be re-verified before Phase 1 signs a contract, not as a locked-in cost. Where a vendor does not publish pricing (e.g. Exotel), figures are third-party estimates and are marked as such.

---

## 1. Telephony (India)

### 1.1 Plivo
- Pay-as-you-go voice pricing exists globally from ~$0.010/min; a dedicated India pricing page exists at plivo.com/voice/pricing/in/ but exact per-minute India rates were not extractable via search snippet or fetch (direct fetch to plivo.com was blocked by this environment's egress proxy — must be re-verified by logging into the Plivo console or contacting sales before committing to a cost model).
- **Bidirectional audio streaming (WebSocket)**: confirmed supported. Enabled via `<Stream>` XML with `bidirectional="true"`, `audioTrack="inbound"` (or `both`), audio as `audio/x-mulaw` @ 8kHz mono, base64-encoded chunks. Add-on cost: **$0.004/min** on top of base voice minutes. SDKs exist for Python/Java (event-driven WebSocket callbacks), and Pipecat has a first-party `PlivoFrameSerializer`.
- **DLT/DND**: Plivo is an India-licensed OSP/ILD provider and integrates with DLT-registered sender IDs for SMS; for voice, compliance responsibility (DLT registration of the calling entity, DND scrubbing of numbers before dialing) sits primarily with the customer, not automated by Plivo out of the box — needs explicit confirmation from Plivo sales for the voice+DLT integration story.
- Sources: [Plivo Voice Pricing (IN)](https://www.plivo.com/voice/pricing/in/), [Plivo Audio Streaming for Voice AI](https://www.plivo.com/audio-streaming/), [Plivo Audio Streaming docs](https://www.plivo.com/docs/voice/xml/audio-streaming), [How Plivo Bidirectional Audio Streaming Works](https://medium.com/@vinayak702010/how-plivo-bidirectional-audio-streaming-works-over-websockets-c4f07fbdc8a4), [Plivo vs Exotel vs Ozonetel vs Twilio India 2026](https://caller.digital/blog/telephony-partner-voice-ai-india-plivo-exotel-ozonetel-knowlarity-twilio-2026)

### 1.2 Exotel
- Exotel does **not publish pricing publicly**; its pricing page routes to a sales conversation. Third-party aggregator estimates (Sep 2026): Grow plan outbound ≈ **₹0.60–₹1.50/min**; industry benchmark range for India voice generally: outbound-to-mobile ₹0.80–₹1.80/min via aggregator or ₹0.60–₹1.20/min via direct SIP; inbound toll-free ₹1.20–₹2.50/min. Credits model: ~$0.01/credit, spent across voice/SMS/WhatsApp, billed on 30s or 60s pulse depending on plan.
- **Streaming (bidirectional)**: confirmed supported via **AgentStream** / the "Stream and Voicebot Applet" — bidirectional WebSocket streaming of raw/slin 16-bit 8kHz mono PCM (base64), chunked in multiples of 320 bytes. Documented events: Connected, Start, Media, DTMF, Stop, Clear. Exotel publishes a worked example wiring AgentStream to OpenAI's Realtime API, and Pipecat ships a dedicated Exotel WebSocket transport.
- **DLT/DND**: Exotel is a long-standing India telecom/CPaaS player and markets itself on TRAI/DLT compliance tooling for its call-center and IVR customers, but exact automated-DND-scrubbing and DLT-registration-assist features for a third-party AI calling platform need direct confirmation from Exotel's compliance/sales team — not fully documented in public sources found.
- Sources: [Exotel Pricing 2026 guide](https://www.cloudtalk.io/blog/exotel-pricing/), [Exotel AgentStream developer guide](https://developer.exotel.com/docs/agentstream/developer-guide), [Exotel Stream/Voicebot Applet](https://developer.exotel.com/docs/agentstream/stream-voicebot-applet), [Exotel AgentStream bidirectional blog](https://exotel.com/blog/build-a-real-time-speech-to-speech-ai-voice-assistant-on-exotel-agentstream-bidirectional-with-openai-realtime-python/), [Pipecat Exotel WebSocket transport](https://docs.pipecat.ai/deployment/pipecat-cloud/guides/telephony/exotel-websocket)

**Recommendation impact**: Both providers support the bidirectional-streaming pattern this platform needs; Plivo's per-minute add-on for streaming ($0.004/min) is explicitly published, Exotel's is not — a point in Plivo's favor for cost auditability, pending final India per-minute rate confirmation for both.

---

## 2. Speech-to-Text (STT)

### 2.1 Sarvam AI (Saarika / Saaras)
- **Pricing**: ₹30/hour of audio (₹0.50/min); ₹45/hour (₹0.75/min) with speaker diarization. Pay-per-use, billed in INR. New accounts get ₹1,000 free credits. Tiers: Starter (PAYG, 60 req/min), Pro (₹10,000/mo, 200 req/min), Business (₹50,000/mo, 1,000 req/min).
- **Model note**: Saarika v2.5 is being deprecated; Sarvam is steering customers to **Saaras v3** — confirm active model name before integration.
- **Language/streaming**: Purpose-built for Indian languages, multi-speaker and mixed-language (Hindi/Hinglish code-switching) content; streaming STT is supported per Sarvam + Pipecat's official Sarvam integration.
- Sources: [Sarvam API Pricing](https://www.sarvam.ai/api-pricing), [Sarvam Pricing docs](https://docs.sarvam.ai/api-reference-docs/pricing), [Sarvam STT REST API](https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/speech-to-text/rest-api)

### 2.2 Deepgram (Nova-3)
- **Pricing**: Streaming Pay-As-You-Go: **$0.0077/min** standard (a promo rate of $0.0048/min was noted as time-limited). Growth/annual-prepaid tier: **$0.0065/min**. Speaker diarization add-on: +$0.0020/min on streaming. Billed by actual audio duration, not rounded minutes.
- **Language**: Strong English/multilingual; Hindi/Indian-language + code-switching quality is not as proven as Sarvam for Hinglish — treat as a fallback/alternate for English-heavy segments, not primary for vernacular.
- Sources: [Deepgram Pricing](https://deepgram.com/pricing), [Deepgram Pricing 2026 breakdown](https://www.happyrobot.ai/hub/deepgram-pricing), [Deepgram Nova-3 pricing analysis](https://brasstranscripts.com/blog/deepgram-pricing-per-minute-2025-real-time-vs-batch)

### 2.3 Groq-hosted Whisper (large-v3 / large-v3-turbo)
- **Pricing**: Whisper **large-v3-turbo**: **$0.04/hour** of audio (~$0.00067/min) — Groq's LPU inference makes this dramatically cheaper than OpenAI's own Whisper API ($0.36/hr). Whisper large-v3 (non-turbo, higher accuracy): $0.111/hour (~$0.00185/min).
- **Note**: Groq Whisper is typically used as **batch/near-real-time** transcription (fast turnaround, not a native low-latency streaming socket like Deepgram/Sarvam); for a live barge-in voice agent it is more often paired with short-chunk streaming or used as a cost-optimized fallback rather than the primary live-turn STT. Self-hosted faster-whisper (open-source, MIT license) remains an option for on-prem/data-residency-sensitive deployments at infra cost only (GPU/CPU hosting), trading pricing for ops burden.
- Sources: [Groq Whisper large-v3-turbo pricing](https://console.groq.com/docs/model/whisper-large-v3-turbo), [Groq pricing overview 2026](https://www.eesel.ai/blog/groq-pricing)

**STT recommendation impact**: Sarvam remains the strongest primary for Hindi/Hinglish/code-switching quality and is India-priced in INR (auditable for an India-first product); Deepgram and Groq Whisper are credible alternates/fallbacks, with Groq Whisper being the cheapest option for high-volume English-heavy or batch-style transcription.

---

## 3. Text-to-Speech (TTS)

### 3.1 Sarvam Bulbul (v3, beta pricing as of Aug 2026)
- **Pricing**: ₹30 per 10,000 characters (~$3.60/million characters — far below Western TTS APIs charging tens of dollars per million characters). ₹100 free credits on signup.
- **Languages/voices**: 30+ persona voices across 11 Indian languages (Hindi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Odia, English-IN), adjustable speed 0.5x–2.0x, streaming supported (confirmed via official Pipecat Sarvam TTS service integration).
- Sources: [Sarvam Bulbul v3 explainer](https://invideo.io/blog/sarvam-bulbul-indian-tts/), [Sarvam API Pricing](https://www.sarvam.ai/api-pricing), [Pipecat Sarvam TTS service](https://docs.pipecat.ai/api-reference/server/services/tts/sarvam)

### 3.2 Cartesia (Sonic-3 / Sonic Turbo)
- **Pricing**: credit-based, ~1 credit/character, plans from free (20K credits) to Scale ($299/mo, 8M credits) → roughly **$5–$37 per million characters** depending on plan tier. Voice-cloning at 1.5 credits/char. A dedicated "Line" voice-agent product bills flat **$0.06/min** of call duration.
- **Streaming**: WebSocket-native, industry-leading latency — Sonic-3 ~90ms time-to-first-audio, Sonic Turbo ~40ms.
- **Indian language support**: not confirmed as a strength; primarily English/global-language focused — treat as a Premium-tier low-latency alternate, not a Hindi-first primary.
- Sources: [Cartesia Pricing docs](https://docs.cartesia.ai/pricing), [Cartesia Sonic 3 pricing 2026](https://www.eesel.ai/blog/cartesia-sonic-3-pricing)

### 3.3 ElevenLabs
- **Pricing**: API $0.10/1,000 characters (multilingual models) or $0.05/1,000 characters (Flash/Turbo models) → **$50–$100/million characters**, the most expensive option evaluated. Commercial license included from the Starter ($5/mo) plan up; free tier disallows commercial use.
- **Quality**: widely regarded as top-tier for naturalness/emotion, supports Hindi among its multilingual models, but at premium cost — a Premium-tier candidate only for flagship/high-value calls.
- Sources: [ElevenLabs Pricing 2026 breakdown](https://www.cekura.ai/blogs/elevenlabs-pricing), [ElevenLabs official pricing](https://elevenlabs.io/pricing)

### 3.4 Piper (open-source, self-hosted)
- **Licensing (important, changed recently)**: the original `rhasspy/piper` repo was **MIT-licensed** but was **archived (read-only) in October 2025**. Active development moved to `OHF-Voice/piper1-gpl`, which is **GPL-3.0**. GPL-3.0 is copyleft — distributing/linking the engine into a proprietary product can trigger source-release obligations; running it as an arm's-length internal HTTP service (Pipecat's documented pattern) avoids linking it directly into proprietary code, but this is a legal question, not just a technical one, and should be reviewed by counsel before shipping. Individual voice models also carry their own licenses (some are "personal use/research only") — each voice must be checked separately.
- **Cost**: no per-request API cost — only self-hosting infra (CPU is often sufficient; GPU not required), making it the cheapest TTS option at volume but with real ops and licensing overhead.
- Sources: [Piper TTS licensing explainer](https://www.cekura.ai/discover/piper-tts), [Coqui/Piper licensing comparison 2026](https://www.promptquorum.com/power-local-llm/local-tts-voice-cloning-piper-coqui-xtts)

### 3.5 AI4Bharat Indic Parler-TTS / IndicF5
- Open-source Indic TTS research models from AI4Bharat; no commercial hosted pricing (self-host only). Quality and production-readiness for a commercial low-latency voice pipeline is less proven than Sarvam Bulbul or Piper in production deployments as of this search; recommend treating as an experimental/future self-hosted option pending a dedicated technical eval, not a Phase 1 default.

**TTS recommendation impact**: Sarvam Bulbul remains the strongest primary on cost + Indian-language coverage + confirmed streaming; Cartesia is the best low-latency Premium alternate; ElevenLabs is a quality-ceiling option at high per-minute cost; Piper is viable as a self-hosted Economy fallback but its GPL-3.0 relicensing must be reviewed by counsel before use in a commercial SaaS.

---

## 4. LLM

### 4.1 Google Gemini Flash-Lite / Flash
- **Gemini 2.5 Flash-Lite**: $0.10/M input tokens, $0.40/M output tokens. **Being retired 2026-10-16.**
- **Gemini 2.5 Flash**: $0.30/M input, $2.50/M output. Also scheduled for deprecation 2026-10-16.
- **Successors** (as found at search time): Gemini 3.1 Flash-Lite ($0.25 in / $1.50 out), Gemini 3.5 Flash-Lite ($0.30 in / $2.50 out) — i.e., the "Flash-Lite" successor tier has gotten **more expensive** than the 2.5 generation it replaces. **This must be re-verified at Phase 1 kickoff** since both current models expire within weeks of this document and pricing/model naming is actively shifting.
- Sources: [Gemini API official pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini pricing 2026 overview](https://www.cloudzero.com/blog/gemini-pricing/), [Gemini 2.5 Flash-Lite pricing detail](https://pricepertoken.com/pricing-page/model/google-gemini-2.5-flash-lite)

### 4.2 Groq-hosted Llama
- **Llama 3.3 70B**: as of **2026-08-26**, Groq moved this model to **enterprise-only "contact sales" pricing** — no longer self-serve. Last public self-serve rate was $0.59/M input, $0.79/M output.
- **Llama 3.1 8B Instant** (still self-serve): $0.05/M input, $0.08/M output — the cheapest viable Groq option, at some quality cost vs. 70B.
- **Implication**: the original spec's "Groq Llama 3.1/3.3 hosted" alternate is now split — 3.1-8B remains a cheap self-serve alternate, but 3.3-70B requires an enterprise sales conversation, which changes cost predictability for that path.
- Sources: [Groq pricing 2026 overview](https://www.cloudzero.com/blog/groq-pricing/), [Groq Llama 3.1 8B pricing](https://www.helicone.ai/llm-cost/provider/groq/model/llama-3.1-8b-instant), [Llama 3.3 70B cost analysis 2026](https://markaicode.com/pricing/llama-33-pricing/)

**LLM recommendation impact**: Gemini Flash-Lite remains the primary on cost given its per-token rate is still lowest found, but its Sep–Oct 2026 deprecation means Phase 1 must pin down the exact successor model and price at build time, not rely on this document's numbers. Groq Llama 3.1-8B-Instant is a credible ultra-cheap alternate for the Economy tier; Groq 3.3-70B is no longer a self-serve alternate for cost modeling purposes.

---

## 5. Orchestration Framework: Pipecat vs LiveKit Agents

- **Pipecat** (Daily, open-source, Python): transport-agnostic pipeline of swappable frame processors (STT/LLM/TTS as pipeline stages); plugs into Daily, LiveKit, raw WebSocket, or a Twilio/Plivo/Exotel phone leg. Strongest for conversation-logic control (barge-in tuning, frame-level audio, provider swapping) and has first-party serializers/integrations for Plivo and Exotel already (confirmed above), a large and fast-moving integration library.
- **LiveKit Agents**: built on LiveKit's own WebRTC media server — wins on production media/infra (reconnection handling, low-latency transport, native SIP trunking, scaling to many concurrent calls) if self-hosting LiveKit's server.
- **2026 consensus from multiple comparison sources**: Pipecat is regarded as the strongest general-purpose open-source voice-agent framework for teams that need broad provider flexibility and fast iteration; LiveKit Agents is preferred when the primary challenge is WebRTC/SIP infrastructure at large scale.
- **Recommendation**: **Pipecat** as primary — its transport-agnostic design and existing Plivo/Exotel integrations map directly onto this project's telephony-adapter requirement (never hard-code a provider), and its Python-first design matches the real-time-streaming runtime this service needs (see ARCHITECTURE.md). LiveKit Agents documented as the alternate if/when concurrent-call scale or native SIP trunking needs outgrow Pipecat's current telephony glue.
- Sources: [Pipecat vs LiveKit — Forasoft](https://www.forasoft.com/blog/article/pipecat-vs-livekit-agents), [Vapi vs Pipecat vs LiveKit 2026](https://inworld.ai/resources/vapi-vs-pipecat-vs-livekit), [Pipecat vs LiveKit — Cekura](https://www.cekura.ai/blogs/pipecat-vs-livekit-the-real-difference)

---

## 6. Compliance: TRAI / DLT / DND / TCCCPR

- **TCCCPR 2018** is the base regulation (Telecom Commercial Communications Customer Preference Regulations), amended most recently in **February 2025** and again in **September 2026**.
- **February 2025 amendment** key changes: spam-reporting window extended from 3 to 7 days; "inferred consent" now valid only for the life of the contractual relationship; "explicit consent" for a commercial transaction now valid for only **7 days** from the date it was acquired (must be re-obtained per interaction cycle beyond that window); a key compliance deadline of **10 March 2026** was set for final provisions to take full effect.
- **Numbering series requirement**: promotional commercial calls must originate from **140-series** numbers; BFSI service calls must use **1600-series** numbers (deadline **1 January 2026**).
- **DLT mandate**: every commercial caller must be registered on the DLT (Distributed Ledger Technology) platform (via a registered telemarketer entity and registered headers/templates) **before making any outbound commercial call or message** — this applies to automated/AI voice calls exactly as it does to human agents; TRAI has explicitly stated automated voice systems are subject to the same TCCCPR rules as human-operated call centres.
- **DND**: numbers registered on the National Do Not Disturb (NDNC) registry must be scrubbed from any outbound commercial calling list unless the customer has valid, current explicit or inferred consent as defined above.
- **September 2026 amendment**: introduces AI/ML-based detection by telecom service providers (TSPs) to identify Customer Line Identifications (CLIs) with high probability of being used for unsolicited commercial communication — i.e. regulatory enforcement itself is now becoming AI-driven, raising the bar for compliant registration/sender-ID hygiene.
- Sources: [TRAI Feb 2025 Regulation (official PDF)](https://www.trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf), [TRAI's Crackdown on Spam Calls and AI-Driven Telemarketing — Chambers](https://chambers.com/articles/trai-s-crackdown-on-spam-calls-and-ai-driven-telemarketing), [TRAI DND & DLT Compliance — AI Outbound 2026](https://www.caller.digital/blog/trai-dnd-compliance-ai-outbound-calling-india), [TRAI Feb 2025 amendment and Voice AI](https://rootle.ai/blog/the-february-2025-trai-amendment-voice-ai-compliance/), [TRAI tightens spam rules Sep 2026](https://officenewz.com/2026/09/18/trai-tightens-spam-call-rules-new-norms-for-ai-automated-and-robocalls/)

See `COMPLIANCE.md` for the full non-legal-advice summary and the explicit disclaimer required by the master spec.

---

## 7. Open items to re-verify before Phase 1 build starts

1. Exact current Plivo India per-minute inbound/outbound voice rate (blocked by egress proxy during this session — needs console login or sales contact).
2. Exact current Exotel India per-minute voice rate (Exotel does not publish; needs a sales quote).
3. Confirm active Sarvam STT model name (Saarika v2.5 → Saaras v3 migration) and its current per-minute pricing at integration time.
4. Confirm Gemini's post-2026-10-16 successor model name/pricing (2.5 Flash-Lite/Flash are being retired within weeks of this document).
5. Confirm whether Groq Llama 3.3 70B enterprise pricing is reachable/affordable for this project's volume, or whether 3.1-8B-Instant (or another vendor) should be the sole Groq-hosted alternate.
6. Get written confirmation from Plivo/Exotel on their DLT-registration-assist and DND-scrubbing tooling specifically for AI/bot-originated outbound calls (not just human agent call centers).
7. Legal review of Piper's GPL-3.0 relicensing (post Oct 2025) and per-voice-model license terms before using it as a self-hosted TTS in a commercial SaaS.
