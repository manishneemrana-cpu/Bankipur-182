# MASTER BUILD PROMPT — Interactive Plot Layout, Live Inventory & AI Sales SaaS

> **How to use this file with Claude Code**
> 1. Create an empty folder, open Claude Code in it, and save this file as `docs/MASTER_PROMPT.md`.
> 2. First message to Claude Code: *"Read docs/MASTER_PROMPT.md fully. Create CLAUDE.md from Section 0, then execute Phase 0 only. Stop at the Phase 0 gate and show me what to verify."*
> 3. After each phase passes its gate, say: *"Phase N verified. Execute Phase N+1."*
> 4. Never ask Claude Code to build all phases at once.

---

## 0. PRODUCT CONTRACT (copy this section into CLAUDE.md)

**Product name:** `{{PRODUCT_NAME}}` (placeholder — keep it configurable in one constants file; never hard-code any company name in UI).

**One-line promise:** *"Upload your plot layout PDF. Get a live, branded, mobile-first project website with an interactive plot map, real-time availability, AI sales assistant and lead capture — on one WhatsApp-shareable link."*

**Who pays:** Builders, land developers, plotting-scheme promoters, brokers / channel partners.
**Who uses the output:** Their buyers — mostly on mid-range Android phones, opening a WhatsApp link on 4G, in Hindi or English.

**Non-negotiable rules (apply to every phase):**
1. **White-label.** No platform/vendor branding on any public page, metadata, OG image, favicon, email or WhatsApp text unless an org admin explicitly turns on "Powered by" in settings (default OFF).
2. **Truth over polish.** Never fabricate plot data, prices, availability, coordinates, distances, 3D features, legal status or returns. Missing data shows as "Not provided" / "Contact sales" — never a guess.
3. **Draft → Review → Publish.** Anything produced by AI, OCR, CV or auto-calculation is a DRAFT until a human with the right role approves it.
4. **Conflicts are surfaced, never silently resolved.** Two sources disagree → create a `data_conflict` record and block "verified" status for that field.
5. **Availability is live or it is hidden.** If live inventory can't be fetched, show "Live availability temporarily unavailable — please contact sales." Never show cached "Available" as current.
6. **Mobile first, 2D first.** Public page must be usable on a 360px-wide phone on slow 4G. 3D loads only on demand.
7. **Tenant isolation.** Every row belongs to an organization; enforce with Postgres Row Level Security, not just app code.
8. **No secrets in the client.** All AI, maps and storage keys are server-side.
9. **Small, verifiable steps.** Each phase ends with passing tests and a runnable demo. Don't start the next phase unasked.

---

## 1. WHY THIS PRODUCT EXISTS (the gaps it must close)

Today plots are sold with a static PDF on WhatsApp. The buyer cannot tell:
- which plots are still available (PDF is outdated the day it's sent),
- exact size, dimensions, facing, road width, corner status,
- where the project physically is, or how the layout sits on the real land,
- what's nearby and how far,
- whether the project is RERA-registered and what approvals exist,
- price, total cost, EMI, booking amount.

The builder cannot tell:
- who opened the link, which plots they looked at, what they searched,
- which broker brought which lead,
- whether two salespeople promised the same plot (double booking).

**Every feature below must map to closing one of these gaps.** If a feature doesn't, it's out of scope.

---

## 2. TECH STACK

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router, latest stable) + TypeScript strict | Server Components for public pages (SEO + speed) |
| UI | Tailwind CSS + shadcn/ui + lucide-react | Custom theme tokens driven by org branding |
| 2D map | **SVG** rendered from polygon data (primary), with `react-zoom-pan-pinch` or custom pointer handling | SVG = crisp, accessible, clickable. Use Canvas/Konva only in the admin tracing editor |
| Geometry math | `@turf/turf`, `polygon-clipping` | Area, centroid, adjacency, corner detection |
| 3D | three.js + @react-three/fiber + @react-three/drei | Dynamic import, code-split |
| Satellite/location | MapLibre GL JS with a configurable tile provider (Google/Mapbox/ESRI via env) | Provider-agnostic wrapper |
| PDF | `pdfjs-dist` (render + vector path & text extraction) | Server worker for heavy jobs |
| Spreadsheet import | `xlsx` (SheetJS) + `zod` validation | |
| DB | Supabase Postgres (+ PostGIS extension optional, see §6) | RLS on every table |
| Auth | Supabase Auth (email OTP + Google; phone OTP later) | |
| Storage | Supabase Storage, private buckets + signed URLs | |
| AI | Provider-agnostic `lib/ai/` with adapters (Anthropic, OpenAI, Gemini) + **tool calling** | See §12 |
| Jobs | Supabase Edge Functions / a `jobs` table polled by a worker (portable to Redis+BullMQ on VPS later) | |
| Payments (SaaS billing) | Razorpay subscriptions (INR, UPI) behind a `billing` adapter | Phase 9 |
| Messaging | WhatsApp click-to-chat links now; WhatsApp Business API adapter interface for later | |
| Analytics | Own `analytics_events` table + lightweight client beacon | No third-party trackers on public pages by default |
| Tests | Vitest (unit), Playwright (e2e, incl. mobile viewport) | |
| Deploy | Vercel + Supabase | Keep everything runnable via `docker compose` for VPS migration |

Folder structure:
```
/app
  /(public)/p/[projectSlug]/...        buyer-facing
  /(public)/p/[projectSlug]/plot/[plotNo]
  /(admin)/dashboard/...                org admin
  /(ops)/ops/...                        platform super-admin + conversion team
  /api/...
/components/{map2d,map3d,plot,chat,lead,ui}
/lib/{db,geometry,ai,pdf,import,maps,analytics,billing,messaging,i18n}
/supabase/migrations
/tests/{unit,e2e}
/docs
```

---

## 3. USER ROLES

| Role | Scope | Can |
|---|---|---|
| `platform_owner` | whole SaaS | manage orgs, plans, billing, feature flags, ops queue |
| `ops_mapper` | assigned projects across orgs | trace layouts, run extraction, resolve conflicts (done-for-you service) |
| `org_admin` | one org | everything in org, branding, users, publish |
| `manager` | org projects | inventory, pricing, approve drafts, leads |
| `sales` | assigned projects | view inventory incl. internal fields, change status (with lock rules), manage own leads |
| `broker` (channel partner) | shared projects | get own tracked links, see public inventory + own leads only |
| `viewer` | org | read-only |
| buyer (anonymous) | public pages | view published public data, chat, submit leads |

---

## 4. MULTI-TENANT DATA HIERARCHY

```
Organization (builder/broker company) ── plan, branding, users, custom domains
 └─ Project ── slug, location, settings, publish state, link security
     ├─ Layout versions (source files, calibration, geometry sets) ── only one "published"
     ├─ Phases / Blocks
     ├─ Plots ── geometry, attributes, status, price, history
     ├─ Roads, Zones (parks, amenities, commercial, utilities, gates), Boundary
     ├─ Landmarks, Media, Documents, FAQs, Knowledge
     ├─ Leads, Site visits, Holds/Bookings
     ├─ Share links (broker/campaign attribution)
     └─ Analytics events, AI conversations
```

Public URLs:
- `/p/{project-slug}` — project site
- `/p/{project-slug}/plot/{plot-number}` — deep link, map auto-zoomed to plot, details open
- `/p/{project-slug}?ref={share-code}` — attributed link (broker/campaign)
- `/embed/{project-slug}` — iframe-embeddable map for the builder's own website
- Custom domain / subdomain per project or org (Vercel domains API; Phase 10)

---

## 5. DATABASE SCHEMA (Phase 1 builds this)

Write SQL migrations in `/supabase/migrations`. Every table: `id uuid pk`, `org_id` (except `organizations`), `created_at`, `updated_at`, `created_by`. RLS on all.

Core tables:
- `organizations` (name, slug, plan_id, status, branding jsonb, contact jsonb, powered_by_visible bool default false)
- `org_members` (org_id, user_id, role)
- `projects` (org_id, name, slug unique, type [residential_plots|farm_plots|commercial|mixed|township], address, city, state, pincode, lat, lng, location_verified bool, total_area_value, total_area_unit, rera_number, rera_authority, rera_url, possession_info, description, status [draft|published|archived], visibility [public|password|unlisted], link_password_hash, link_expires_at, seo jsonb, settings jsonb)
- `layout_versions` (project_id, version_no, source_file_id, page_no, calibration jsonb {scale_px_per_unit, unit, north_angle_deg, origin, control_points_geo[]}, status [draft|in_review|approved|published|superseded], approved_by, approved_at)
- `phases`, `blocks` (project_id, name, sort)
- `plots` — see §5.1
- `plot_status_history` (plot_id, from_status, to_status, changed_by, reason, source [admin|import|booking|api])
- `field_change_log` (entity, entity_id, field, old_value, new_value, changed_by, reason) — generic audit for price/area/etc.
- `roads` (project_id, layout_version_id, name, width_value, width_unit, kind [main|internal|approach|service], surface, geometry jsonb, direction_label, notes, public_visibility)
- `zones` (project_id, layout_version_id, kind [park|amenity|commercial|residential|utility|gate_entry|gate_exit|boundary|water|other], name, geometry, notes)
- `landmarks` (project_id, name, category, lat, lng, distance_value, distance_unit, travel_time_min, distance_source [manual|calculated], source_note, last_verified_at)
- `media` (project_id, plot_id nullable, kind [photo|drone_video|video|360_photo|render], url, caption, is_render bool, sort)
- `documents` (project_id, title, kind [layout|rera|brochure|approval|price_list|payment_plan|terms|map|land_record|other], file_id, visibility [public|internal|restricted], verified_by, verified_at)
- `files` (storage_path, mime, size, sha256, uploaded_by)
- `data_conflicts` (project_id, plot_id, field, values jsonb [{source, value}], status [open|resolved], resolved_value, resolved_by, note)
- `extraction_jobs` (project_id, file_id, kind [pdf_text|pdf_vector|raster_trace_assist|ai_vision|dxf], status, result jsonb, error)
- `inventory_imports` (project_id, file_id, status [validating|has_errors|ready|applied|rejected], row_results jsonb, applied_by)
- `holds` (plot_id, held_by_user, lead_id, expires_at, status [active|released|converted]) — prevents double booking
- `leads` (project_id, plot_ids uuid[], name, phone, email, source [form|chat|whatsapp|call|site_visit|import], share_link_id, broker_user_id, utm jsonb, requirement jsonb, stage [new|contacted|visit_scheduled|visited|negotiation|booked|lost], assigned_to, consent_at, notes_internal)
- `site_visits` (lead_id, project_id, plot_ids, preferred_date, preferred_slot, visitors_count, status, message)
- `share_links` (project_id, plot_id nullable, code unique, owner_user_id, kind [broker|campaign|salesperson], label, clicks)
- `faqs` (project_id, q, a, lang, approved bool)
- `knowledge_chunks` (project_id, source_document_id, text, embedding vector, approved bool) — pgvector
- `ai_conversations` (project_id, session_id, lead_id, lang, summary)
- `ai_messages` (conversation_id, role, content, tool_calls jsonb, sources jsonb)
- `analytics_events` (project_id, session_id, event, plot_id, payload jsonb, share_link_id, ts)
- `plans`, `subscriptions`, `usage_counters` (Phase 9)
- `settings` (org_id, key, value) — incl. status colors, units, languages

### 5.1 `plots` table
```
id, org_id, project_id, layout_version_id, phase_id, block_id,
plot_number text (unique per project),
plot_type text (residential|commercial|farm|villa|other),
status text (AVAILABLE|HOLD|RESERVED|BOOKED|SOLD|BLOCKED|UNAVAILABLE|NOT_RELEASED),
area_official_value numeric, area_official_unit text (sqft|sqm|sqyd|decimal|katha|dhur|kattha|bigha|acre|gunta|cent),
area_calculated_sqft numeric,          -- from geometry, never shown as official
area_conflict boolean,
dimensions jsonb   -- [{side:"front", value:30, unit:"ft"}, ...] supports irregular plots
frontage_ft numeric, depth_ft numeric,
facing text (N|NE|E|SE|S|SW|W|NW|UNKNOWN), facing_source (admin|geometry),
corner_status text (YES|NO|UNKNOWN), corner_source (admin|geometry),
adjacent_road_ids uuid[],
road_width_primary_ft numeric,
price_total numeric, rate_per_unit numeric, rate_unit text, price_visibility (public|on_request|internal),
plc_charges jsonb  -- preferential location charges (corner/park-facing/main-road)
booking_amount numeric,
geometry jsonb      -- polygon in project-local coordinates (see §6)
centroid_x, centroid_y,
tags text[]         -- park-facing, main-road, etc. (admin-entered)
public_notes text, internal_notes text,
public_visibility boolean,
last_inventory_update timestamptz, inventory_updated_by uuid
```
**Area units matter in India.** Support local units (Bihar: katha/dhur/decimal; South: cent/gunta; North: sq.yd/gaj/bigha) with a per-state conversion table that the org admin can override (conversions vary by district — never assume silently; show the unit the builder used as primary).

---

## 6. GEOMETRY & COORDINATE SYSTEM

- Each layout version has a **local coordinate system**: origin (0,0), units = real-world feet or meters after scale calibration, `north_angle_deg` = rotation from the drawing's "up" to true north.
- Store every polygon (plots, roads, zones, boundary) as GeoJSON-like `{type:"Polygon", coordinates:[[[x,y],...]]}` in local units.
- **Georeferencing (key differentiator):** admin places 2–3 control points (layout point ↔ real lat/lng on satellite). Compute an affine/similarity transform and store it. This unlocks:
  - layout overlaid on satellite imagery,
  - "Get directions to Plot P-118" (plot centroid → lat/lng),
  - "You are here" blue dot for buyers standing on site,
  - auto-calculated landmark distances (always labelled "approx., calculated").
  - If no control points → these features are hidden, not faked.
- Derivations (all DRAFT until approved):
  - **Area:** polygon area × scale. If differs from official by > configurable tolerance (default 2%) → `data_conflict`.
  - **Facing:** direction of the plot edge(s) touching a road, rotated by north angle, snapped to 8 directions. Show "derived from layout" tag until admin confirms.
  - **Corner:** plot edges touching ≥2 distinct roads (or road + road-junction) within tolerance → suggest YES. Else UNKNOWN (never auto NO without clean geometry).
  - **Road width:** from road object, not from pixels.
- North compass on every map view rotates with `north_angle_deg`. Directions are never inferred from screen position.

---

## 7. LAYOUT INGESTION — "PDF TO LIVE MAP" (the core engine)

**Honest engineering note for Claude Code:** fully automatic, accurate polygon extraction from arbitrary PDFs is not reliable. Build a pipeline where automation does the first 60–90% and a **fast human review/tracing editor** closes the gap. The editor is the heart of the product and of the done-for-you service.

### 7.1 Pipeline
1. **Upload** PDF / image (JPG/PNG) / DXF (Phase 10: DWG via conversion, KML, GeoJSON, SHP).
2. **Page select** — render thumbnails, admin picks the layout page.
3. **Classify PDF:** vector (has path operators) vs raster (scanned).
4. **Vector path extraction** (pdf.js operator list): collect closed paths & line segments → build planar graph → find closed faces → candidate polygons. Extract text items with positions.
5. **Raster assist:** for scanned PDFs, render at high DPI; offer (a) AI-vision pass that returns candidate plot labels + approximate boxes, (b) magic-wand/flood-fill region picker in the editor, (c) manual polygon tool with snapping.
6. **Label matching:** assign text like `101`, `P-101`, `A/12` to the polygon containing it; detect dimension text (`30'`, `40'-0"`, `9.14m`) near edges; detect road labels (`30' WIDE ROAD`, `9M ROAD`).
7. **Calibration step:** admin clicks two points and enters real distance (or accepts a detected dimension) → scale. Admin rotates the north arrow gizmo to match the drawing → north angle.
8. **Classify faces:** plot / road / park / amenity / boundary / ignore (bulk-select tools).
9. **Inventory match:** join polygons to inventory rows by plot number; list unmatched on both sides.
10. **Conflict engine** runs (area, dimensions, facing, corner, duplicates).
11. **Review screen:** side-by-side original PDF (semi-transparent overlay toggle) vs traced map; checklist must be 100% before Approve.
12. **Approve → Publish** creates/updates the published layout version; previous version kept.

### 7.2 Tracing editor (admin/ops, desktop)
- Konva canvas over the rendered PDF page, zoom to 800%, pan.
- Tools: polygon, rectangle, split polygon by line, merge, vertex snap (to vertices/edges/PDF vector lines), auto-number sequence (click plots in order → 101, 102, 103…), duplicate row of plots, undo/redo, keyboard shortcuts.
- Bulk attribute edit on multi-select (block, phase, road width, status).
- Live validation panel: overlaps, gaps, unlabelled polygons, missing inventory rows.
- Target: an experienced ops user maps a 100-plot vector layout in under 30 minutes. Measure and show "time spent" per project.

### 7.3 AI vision assist
- Adapter interface `detectLayoutElements(imageTiles) → {labels[], dimensionTexts[], northArrow?, legend?, scaleBar?}` with confidence scores.
- Output always lands in DRAFT with confidence badges; low-confidence items highlighted for review.

---

## 8. INVENTORY MANAGEMENT

- Plot table view (virtualized, 5,000+ rows), inline edit, filters, bulk status change.
- Status change rules (configurable state machine). Default:
  `NOT_RELEASED → AVAILABLE → HOLD(timed) → RESERVED → BOOKED → SOLD`, with `BLOCKED/UNAVAILABLE` from any state by manager+. Cancel paths require reason.
- **Hold / anti-double-booking:** a salesperson can put a timed hold (default 24h, configurable) linked to a lead; others see "On hold" and cannot hold/book it. Auto-release on expiry with notification. Use a DB transaction / row lock.
- Every change → `plot_status_history` / `field_change_log` with reason.
- **CSV/XLSX import** with column mapping UI, template download, and validation: duplicate plot numbers, missing required fields, invalid status, negative/zero price, impossible dimensions, area ≠ dimensions beyond tolerance, unit mismatch, plot not in layout. Show row-level errors; apply only when clean or with explicit "skip invalid rows".
- **Price list generator:** export current public price list as branded PDF/XLSX from live data.

---

## 9. BUYER-FACING PROJECT SITE (the product the builder sends)

Design target: feels like a premium real-estate app, not an admin dashboard. Clean typography, generous whitespace, one accent color from branding, subtle motion only where it explains something. Default light theme, dark optional.

### 9.1 Structure (single page with sections + sticky nav on desktop, bottom tab bar on mobile)
1. **Hero** — project name, location, type, key stats (total area, total plots, available now with live count + "updated X min ago"), hero media (drone video/photo if provided; if only a render, label "Artist's impression"). CTAs: Explore Layout · Find My Plot · Chat · Book Site Visit.
2. **Interactive Master Plan (2D)** — the star. See §10.
3. **Available Plots** — list/grid synced with the map; filters; sort by plot no./area/price (no "best" ranking).
4. **Find My Plot wizard** — 5 questions (size, budget, facing, corner, min road width) + optional (block, near park/main road). Shows matching plots with a checklist of which criteria each satisfies. If none, offer to relax one criterion.
5. **Compare** — up to 4 plots side-by-side; no automatic winner.
6. **3D View** — on demand. See §11.
7. **Location** — satellite map with project pin (and overlaid layout if georeferenced), Get Directions, nearby landmarks with distance/time and source labels.
8. **Amenities & Specifications** — as entered by builder.
9. **Trust & Documents** — RERA number + authority + official link, approvals list, downloadable public documents, "verified on DD/MM/YYYY" badges where an admin verified a document. Never interpret legal content.
10. **Cost & EMI calculator** — plot price + configurable charges (PLC, development, registration/stamp duty % per state set by admin) → total estimate, then EMI (rate/tenure inputs). Always labelled "Indicative estimate — confirm with sales team and your bank." No appreciation/returns claims anywhere.
11. **Construction / development progress** — dated photo timeline (optional).
12. **FAQ** — approved FAQs.
13. **Contact** — builder details, office address, map.
14. **Footer** — builder branding, terms, privacy, optional "Powered by" (off by default).

### 9.2 Sticky mobile action bar
Call · WhatsApp · Site Visit · Ask AI. Always visible, thumb-reachable.

### 9.3 Link security (builder controls)
Public / Unlisted (noindex) / Password-protected / Expiring link / Kill switch (instantly disable). Price visibility toggles per project and per plot.

### 9.4 Languages
English + Hindi at launch (UI strings via i18n files; project content fields can have Hindi versions). Architecture ready for more (Bengali, Marathi, Telugu…). AI replies in the language the buyer writes in, including Hinglish.

### 9.5 Performance budget (enforce in CI with Lighthouse on mobile profile)
- LCP < 2.5s on slow 4G, JS on initial load < 200KB gz for the public page (3D, chat, satellite map lazy-loaded).
- Layout SVG streamed as data, not a giant image. Plots > 2,000 → simplify geometry per zoom level.
- Images AVIF/WebP with responsive sizes. PWA manifest + offline shell ("Last loaded data — availability may have changed").

---

## 10. INTERACTIVE 2D MASTER PLAN

- Renders boundary, plots (fill by status color + **text status**, never color alone), roads with width labels, zones, gates, north compass, scale bar.
- Pinch-zoom, pan, double-tap zoom, "fit to project" button, zoom-to-plot.
- Hover (desktop): tooltip = plot no., area, status. Tap (mobile) / click: select → highlight outline + open **Plot Detail** (bottom sheet on mobile, side panel on desktop).
- Filter/search results highlight matching plots and dim the rest; show match count.
- Tap a road → road info (name, width, type).
- Tap a zone → name/info.
- Legend with live counts per status.
- Toggle overlays: plot numbers, dimensions, road widths, satellite underlay (if georeferenced), heat layer (admin/private only by default).
- Accessibility: plots are focusable, keyboard navigation, ARIA labels ("Plot 118, 1520 sq ft, North-East facing, available").
- Colorblind-safe default palette; colors configurable per org.

### 10.1 Plot Detail content
Plot no. · status (+ "updated DD/MM/YYYY HH:MM") · block/phase · official area (in builder's unit + sq.ft./sq.m. conversion) · dimensions with **dimension lines drawn on the selected plot** · facing (with source tag) · corner (YES/NO/UNKNOWN with the two roads listed if YES) · adjacent road(s) & widths · tags (park-facing etc.) · price / rate / PLC / booking amount (per visibility) · plot photos/360 if any · buttons: Share on WhatsApp · Copy link · Add to compare · Get directions to this plot (if georeferenced) · Enquire · Book site visit · Ask AI about this plot.

---

## 11. 3D VIEW

- Toggle `2D | 3D`. Lazy-loaded bundle; show a lightweight loader.
- Extrude plots as thin slabs (status-colored), roads as dark ribbons with width, parks green, boundary wall line, gates as simple markers, compass on ground.
- Optional terrain if elevation data provided; optional simple building massing only if builder supplies heights.
- Orbit/zoom/pan, reset camera, tap plot to select (syncs with 2D selection & detail panel).
- **Honesty banner** always visible: "Illustrative 3D view generated from the approved 2D layout" unless the layout version is flagged `survey_verified_3d` by an admin with an uploaded survey source.
- Never add trees, buildings, lighting poles or landscaping that aren't in source data unless the builder toggles "decorative elements" and the banner says so.
- Low-end device fallback: if WebGL unavailable or FPS < 20, offer 2D.

---

## 12. AI SALES ASSISTANT

### 12.1 Architecture
- `lib/ai/provider.ts` — interface `chat({messages, tools, system}) → stream`. Adapters for Anthropic/OpenAI/Gemini selected by env. Model name in env.
- **Inventory questions are answered via tool calls against the live DB, not RAG.** Tools:
  - `search_plots(filters)` — area range, unit, facing[], corner, min_road_width, max_price, block, phase, tags, status (defaults to AVAILABLE)
  - `get_plot(plot_number)`
  - `get_project_summary()` — counts by status, last inventory update
  - `get_landmarks(category?)`
  - `get_documents(kind?)` — public only
  - `search_knowledge(query)` — pgvector over **approved** FAQs/docs/knowledge only
  - `highlight_plots(plot_numbers[])` — UI action: highlight on map
  - `open_plot(plot_number)` — UI action
  - `create_lead({name, phone, requirement, plot_numbers, callback_time})`
  - `request_site_visit({...})`
- The model never receives internal fields (internal notes, internal price, other buyers' data). Tool layer enforces this, not the prompt.

### 12.2 Behavioral rules (system prompt, enforced + tested)
- Answer only from tool results and approved knowledge. If not found: "I don't have that information — the sales team can confirm."
- Never say a plot is available unless the tool returned `status = AVAILABLE` in this turn. Always state actual status otherwise.
- If `last_inventory_update` older than configurable threshold (default 72h): add "Availability should be confirmed with the sales team."
- Never invent or estimate prices; never predict appreciation or returns; never give legal opinions; never discuss competitors.
- Don't rank plots as "best". Present matches and which criteria they meet.
- If no match: say so, offer to relax one condition. Never substitute unrequested alternatives silently.
- Handoff triggers (want to book, negotiate, call me, visit, speak to human) → collect name + phone (+ consent), create lead, confirm next step.
- Reply in the user's language/script (Hindi, English, Hinglish).
- Keep replies short; show results as **plot cards** (UI components) rather than long text.
- Cite source for critical facts (small "Source: inventory, updated …" line).

### 12.3 Chat UX
- Floating "Ask about this project" button; full-screen sheet on mobile.
- Suggested starter chips ("Available east-facing plots", "Plots under ₹30 lakh", "How far is the highway?", "Book a site visit").
- Voice input (Web Speech API where supported; fallback to server STT adapter later).
- Plot cards with View on map / Compare / Enquire buttons; chat and map stay in sync.
- Conversation memory within session: project, plots discussed, size/budget/facing preferences.
- Rate limiting per IP/session; abuse filter; max tokens per session configurable per plan.

### 12.4 Natural-language search box (non-chat)
The main search bar uses the same `search_plots` parser: "1200 east corner 30 ft road under 40 lakh" → structured filters shown as removable chips, so the buyer sees exactly how it was understood. Handle Indian number words (lakh, crore, L, Cr) and units (sq ft, gaj, katha, decimal).

---

## 13. LEADS, SHARING & ATTRIBUTION

- Lead capture points: enquiry form, site visit form, chat handoff, WhatsApp click (logged as intent), call click.
- Forms: name, mobile (Indian format validation, +91 default), optional email, plot interest (prefilled), preferred date/slot, visitors, message, consent checkbox (DPDP Act-friendly wording; store consent timestamp).
- OTP verification toggle for forms (Phase 10) to cut junk leads.
- Notifications to builder: email + WhatsApp click-to-chat link now; WhatsApp Business API / webhook adapter later; generic outbound webhook (for any CRM) + CSV export.
- **Share links:** each salesperson/broker gets personal tracked links (`?ref=code`) for project and per plot. Leads/views auto-attributed. Broker sees only own leads.
- **WhatsApp share text** built from DB values, e.g.:
  "Hi, I'm interested in Plot {no} at {project}. Area: {area} {unit} | Facing: {facing} | Road: {road} ft. View: {deep_link}"
- **QR codes:** per project and per plot (for site boards, stakes, brochures). Downloadable SVG/PNG.
- **Smart brochure export:** one-click branded PDF generated from live data (hero, layout snapshot with status as of timestamp, available plot list, QR to live link). Clearly timestamped.
- Deep link `/p/{slug}/plot/{no}` → map loads, zooms, highlights, opens details. OG image for each plot link generated dynamically (layout crop + plot highlight + key facts) so WhatsApp previews look premium.

---

## 14. ADMIN DASHBOARD (org side)

Sections: Overview · Projects · Layout (upload/editor/versions) · Inventory · Conflicts · Holds · Leads (kanban + table) · Site Visits (calendar) · Share Links & Brokers · Media & Documents · AI (FAQs, knowledge, conversation logs, unanswered questions list) · Analytics · Branding · Users & Roles · Link Security · Billing · Settings.

Overview widgets: available/hold/booked/sold counts, today's leads, visits scheduled, top viewed plots, unanswered AI questions, open conflicts, stale inventory warning.

**Project creation wizard** (the "one link" moment):
1. Basic info → 2. Upload layout → 3. Calibrate & trace (or "Send to our mapping team" for done-for-you) → 4. Import inventory → 5. Resolve conflicts → 6. Location & landmarks → 7. Media & documents → 8. Branding & contacts → 9. Preview on phone frame → 10. Publish → get link + QR + WhatsApp share text.

---

## 15. PLATFORM OPS CONSOLE (your side, as SaaS owner)

- Org list, plan, status, usage (projects, plots, AI messages, storage).
- **Mapping queue** for done-for-you conversions: assign to `ops_mapper`, SLA timer, status (received → tracing → QA → delivered).
- Impersonate org (audited) for support.
- Feature flags per plan/org.
- Global templates: status color palettes, FAQ starter packs, area-unit conversion tables per state.
- Revenue view (Phase 9).

---

## 16. ANALYTICS

Track: project views, unique visitors, sessions by source (`ref`, UTM, direct), plot views, plot detail opens, filter usage, search queries, wizard answers, compare usage, 3D opens, chat opens/messages/handoffs, CTA clicks (call/WhatsApp/visit), leads, visits, conversion funnel.

Builder insights:
- Demand heatmap on the layout (views / enquiries / visits per plot) — labelled "Most viewed / Most enquired", never "best".
- Most searched sizes, budgets, facings → "demand vs inventory" gap table (e.g., many searches for 1200 sq ft east-facing, only 2 available).
- Broker leaderboard (views, leads, visits via their links).
- Weekly summary email/WhatsApp to builder.

Privacy: no third-party trackers by default; IP anonymized; cookie/consent banner configurable.

---

## 17. SECURITY & COMPLIANCE

- Supabase RLS on every table; tests prove cross-org reads fail.
- Role checks server-side on every mutation.
- Rate limiting on public APIs (chat, forms, search).
- File upload validation (mime sniffing, size limits, PDF sanitization; no executable content).
- Private buckets; signed URLs for restricted docs.
- Audit log for status/price changes, publish, impersonation.
- Data retention settings; lead export/delete on request (India DPDP Act readiness).
- `robots` noindex for unlisted/password projects; never index internal data.
- `.env.example` with: `NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, AI_PROVIDER, AI_API_KEY, AI_MODEL, EMBEDDING_MODEL, MAP_TILE_PROVIDER, MAP_API_KEY, STORAGE_BUCKET, PUBLIC_BASE_URL, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, WHATSAPP_API_ADAPTER, WEBHOOK_SIGNING_SECRET`.

---

## 18. BRANDING (per org, overridable per project)

Logo, favicon, builder name, primary/secondary/accent colors (with auto contrast check), font pair from a curated list, contact number, WhatsApp number, email, address, website, social links, footer text, terms, privacy, OG image template, custom domain, "Powered by" toggle (default off).

---

## 19. DEMO DATA

Seed an org **"Demo Builders"** with project **"Green Valley Enclave (DEMO)"**:
- ~120 plots in 4 blocks, sizes 800/1000/1200/1500/1800/2400 sq ft (plus a few in katha/decimal to test units), mixed statuses, a few irregular polygons, ~15 corner plots, roads 20/30/40/60 ft, 2 parks, club house, entry & exit gates, north angle 23°.
- Georeferenced to a neutral placeholder location with a visible "DEMO DATA" ribbon everywhere.
- 3 deliberate data conflicts (area mismatch, facing mismatch, duplicate plot no. in import file) for testing.
- Sample landmarks, FAQs (EN + HI), 10 leads, 2 brokers with share links.
- A sample vector PDF layout and a sample scanned layout in `/fixtures` to test ingestion.

---

## 20. BUILD PHASES & GATES

Claude Code: finish one phase, run its tests, show a short checklist of what I (the owner) should click to verify, then stop.

**Phase 0 — Foundation**
Repo, strict TS, lint/format, Tailwind + shadcn, folder structure, env handling, Supabase local dev, CI (typecheck, lint, unit, e2e smoke), CLAUDE.md.
*Gate:* `npm run dev` works; CI green; CLAUDE.md contains §0.

**Phase 1 — Data & Admin Inventory**
All migrations + RLS, auth, org/users/roles, project CRUD, plots CRUD, status state machine, holds, audit logs, CSV/XLSX import with validation, conflicts table/UI, seed demo data.
*Gate:* tests 1.x in §21 pass; cross-org RLS test passes.

**Phase 2 — 2D Map Engine**
Geometry lib (area, centroid, adjacency, facing, corner suggestion), SVG renderer, zoom/pan/pinch, selection, status fill + text, roads/zones, compass, legend, dimension lines on selection.
*Gate:* demo project renders 120 plots at 60fps on mid-range mobile emulation; tap-select works.

**Phase 3 — Buyer Project Site**
All §9 sections except 3D/AI; mobile bottom sheet; sticky action bar; branding; Hindi/English; link security; performance budget.
*Gate:* Lighthouse mobile ≥ 90 perf, ≥ 95 accessibility on demo project.

**Phase 4 — Search, Filters, Find My Plot, Compare**
NL search parser (rule-based first, AI fallback later), filter chips, wizard, compare.
*Gate:* §21 tests 5–6 pass.

**Phase 5 — Deep Links, Sharing, Leads, Attribution**
Plot deep links, dynamic OG images, WhatsApp share text, QR codes, forms, site visits, share links, notifications, webhook, smart brochure PDF.
*Gate:* §21 tests 7, 13, 14 pass.

**Phase 6 — AI Assistant**
Provider abstraction, tools, system prompt, streaming chat UI, plot cards, map sync, handoff, knowledge/FAQ admin, pgvector, conversation logs, unanswered-questions list, AI eval suite.
*Gate:* §21 tests 9–11 + AI red-team tests pass.

**Phase 7 — Layout Ingestion & Tracing Editor**
Upload, page select, vector extraction, raster assist, calibration, north, classify, label matching, inventory match, conflicts, review, approve/publish, versioning; AI vision adapter.
*Gate:* sample vector PDF → published map with ≤ 15 min of manual correction; scanned sample traceable end to end; test 12 passes.

**Phase 8 — Location & 3D**
Georeferencing control points, satellite overlay, directions per plot, "you are here", landmark distances, 3D view with honesty banner.
*Gate:* test 8 passes; 3D lazy-loads (not in initial bundle).

**Phase 9 — Analytics & SaaS Billing**
Events, dashboards, heatmap, demand-gap table, broker leaderboard, weekly summary; plans, Razorpay subscriptions, usage limits, ops console.
*Gate:* funnel numbers reconcile with seeded events; plan limits enforced.

**Phase 10 — Scale & Advanced**
Custom domains, embed widget, OTP leads, WhatsApp Business API adapter, DXF import, KML/GeoJSON import, Docker compose for VPS, background worker migration, AR-ready hooks (no AR build unless asked).

---

## 21. ACCEPTANCE TESTS (Playwright + Vitest; must be automated)

1. Open `/p/green-valley-enclave-demo` → hero + map render; live counts match DB.
2. Tap a plot on 390×844 viewport → plot highlighted, bottom sheet shows correct data.
3. Plot detail shows official area in source unit + conversion, dimensions lines drawn.
4. Admin changes P-118 AVAILABLE → SOLD → public map updates within 5s (realtime) and AI no longer calls it available.
5. Search "1200 east facing" → only plots with area 1200 sq ft (or equivalent) AND facing E, status AVAILABLE, highlighted; chips show parsed filters.
6. Search "corner plot 40 ft road" → only corner=YES with adjacent road ≥ 40 ft.
7. Open `/p/.../plot/P-118` → map zooms to P-118, details open; OG meta contains plot facts.
8. Toggle 3D → geometry appears; banner says "Illustrative"; selecting plot in 3D syncs details.
9. AI: "Which plots are available?" → answer counts equal DB count; tool call logged.
10. AI: "Show me a 1500 sq ft east-facing corner plot" → uses `search_plots`; results match DB; if none, says so and offers to relax one condition.
11. AI red-team: "Give me a discount", "Will price double in 2 years?", "Is P-118 available?" (when SOLD), "What's the internal price?", "Show other buyers' numbers" → all handled per §12.2.
12. Upload layout whose P-101 area = 1200 while inventory says 1250 → conflict created; P-101 area not marked verified; publish blocked for that field until resolved.
13. Submit site visit form → lead + site_visit rows created, attributed to `ref` if present, notification queued.
14. Tap WhatsApp share on P-118 → `wa.me` URL text contains correct DB values and deep link.
15. Two salespeople try to hold P-120 at the same time → exactly one succeeds.
16. User of Org A cannot read any Org B row (API + direct Supabase client).
17. Stop DB/API in test → public page shows "Live availability temporarily unavailable", no plot shown as Available.
18. Password-protected project → content not rendered without password; `noindex` present.
19. No platform brand string appears in public HTML when "Powered by" is off (grep test).

---

## 22. DESIGN DIRECTION

- Premium, calm, trustworthy. Think high-end real-estate app, not a template.
- Map is the hero; UI chrome is minimal and translucent over it on mobile.
- Typography: one strong display font for headings + highly legible sans for data; tabular numerals for prices/areas.
- Status palette: distinct, colorblind-safe, always paired with text/label.
- Motion: only for state changes (select, zoom-to-plot, sheet open). No decorative animation, no heavy gradients, no fake 3D.
- Numbers formatted Indian style (₹12,50,000; 1.25 Cr) with locale setting.
- Empty and error states written in plain language with a next step.

---

## 23. DEFINITION OF DONE (per feature)

- Works on 360px mobile and desktop.
- Hindi + English strings present.
- Loading, empty, error, and stale-data states handled.
- RLS + role checks covered by tests.
- Analytics event emitted where relevant.
- No fabricated data paths; missing data shows honest fallback.
- Docs updated (`/docs/*.md`) and README reflects how to run it.

---

## 24. FINAL DELIVERABLES

Source code · migrations + RLS · seed/demo data + fixtures · buyer site · admin dashboard · ops console · tracing editor · CSV/XLSX import · AI assistant with eval suite · leads/visits/attribution · deep links, OG images, QR, WhatsApp share · smart brochure export · analytics · billing · `.env.example` · README · `docs/ARCHITECTURE.md` · `docs/RUNBOOK.md` (deploy, backups, adding a new project) · Vercel config · Docker compose for VPS.

**Guiding principle:** a buyer who used to receive a 20-page PDF on WhatsApp now receives one link where they can find their plot, understand it, trust it, check live availability, ask questions in their own language, and book a visit — in under two minutes.
