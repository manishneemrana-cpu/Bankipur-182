"use client";

import { createClient } from "@/lib/db/supabase/client";

const SESSION_KEY = "pp_session_id";

/** A per-tab session id so events can be grouped into a funnel without any
 * third-party tracker or cookie (§16: no third-party trackers by default). */
export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

export type AnalyticsEvent =
  | "project_view"
  | "plot_view"
  | "plot_detail_open"
  | "filter_use"
  | "search_query"
  | "wizard_use"
  | "compare_use"
  | "view_3d"
  | "chat_open"
  | "chat_message"
  | "chat_handoff"
  | "cta_call"
  | "cta_whatsapp"
  | "cta_visit"
  | "lead_submit"
  | "visit_submit";

/** Fire-and-forget analytics beacon through the public track_event RPC.
 * Never blocks or throws into the caller — a dropped event is not worth
 * breaking the page over. Known gap: password-protected projects don't get
 * tracked (the password lives in an httpOnly cookie, unreadable here) —
 * acceptable for this phase rather than adding a server round trip just for
 * the beacon. */
export function track(
  projectSlug: string,
  event: AnalyticsEvent,
  opts?: {
    plotNumber?: string;
    ref?: string;
    payload?: Record<string, unknown>;
  },
): void {
  const supabase = createClient();
  void supabase
    .rpc("track_event", {
      p_slug: projectSlug,
      p_password: null,
      p_session_id: getSessionId(),
      p_event: event,
      p_plot_number: opts?.plotNumber ?? null,
      p_ref: opts?.ref ?? null,
      p_payload: opts?.payload ?? {},
    })
    .then(
      () => undefined,
      () => undefined,
    );
}
