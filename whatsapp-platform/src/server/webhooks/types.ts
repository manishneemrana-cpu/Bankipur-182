/**
 * Minimal typed shape of a WhatsApp Cloud API webhook delivery, covering the
 * event types this phase actually processes (inbound text messages, outbound
 * status updates). See docs/meta-current-state.md for how this was
 * researched and its confidence level — the top-level envelope
 * (object/entry/changes/value) is long-stable across current sources, but
 * treat any field not used below as unverified until Phase 5+ needs it.
 */
export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id?: string; // WABA id
  changes?: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  field?: string;
  value?: {
    messaging_product?: string;
    metadata?: {
      display_phone_number?: string;
      phone_number_id?: string;
    };
    contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
    messages?: WhatsAppInboundMessage[];
    statuses?: WhatsAppStatusUpdate[];
  };
}

export interface WhatsAppInboundMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
}

export interface WhatsAppStatusUpdate {
  id?: string; // meta_message_id
  status?: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string }>;
}
