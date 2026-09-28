import "server-only";

import { serverEnv } from "@/lib/env/server";

/** WhatsApp Business API adapter interface (§13, Phase 10) — today's
 * WhatsApp integration is click-to-chat (wa.me links, lib/messaging/
 * whatsapp.ts), which needs no credentials. This is the seam a real
 * Business API adapter (template messages, delivery receipts) plugs into
 * once WHATSAPP_API_ADAPTER names one and credentials exist — neither is
 * true in this environment, so it stays unimplemented rather than faked. */
export interface WhatsAppBusinessAdapter {
  sendTemplateMessage(args: {
    to: string;
    templateName: string;
    params: string[];
  }): Promise<{ ok: true } | { ok: false; error: string }>;
}

export function getWhatsAppBusinessAdapter(): WhatsAppBusinessAdapter | null {
  const env = serverEnv();
  if (env.WHATSAPP_API_ADAPTER !== "none") {
    // A named adapter would be constructed here; none are implemented yet.
    return null;
  }
  return null;
}
