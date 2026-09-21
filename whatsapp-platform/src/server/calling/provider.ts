import "server-only";

/**
 * Provider-agnostic interface for the founder's existing AI-calling
 * platform, per the brief: WhatsApp lead -> CRM -> qualification -> AI call
 * -> outcome -> CRM update -> WhatsApp follow-up. No vendor is wired in —
 * this defines the contract a real integration would implement.
 */
export interface InitiateCallInput {
  organizationId: string;
  leadId: string;
  phoneE164: string;
  /** Free-form context passed to the calling platform, e.g. property interest, budget. */
  context: Record<string, unknown>;
}

export interface CallOutcome {
  callId: string;
  status: "COMPLETED" | "NO_ANSWER" | "FAILED";
  summary: string | null;
  qualifiedForFollowUp: boolean;
}

export interface CallingProvider {
  initiateCall(input: InitiateCallInput): Promise<{ callId: string }>;
  /** Called by the calling platform's own webhook once a call finishes — not built yet. */
  getCallOutcome(callId: string): Promise<CallOutcome | null>;
}

export class NotConfiguredCallingProvider implements CallingProvider {
  async initiateCall(): Promise<{ callId: string }> {
    throw new Error("No calling provider is configured yet (Phase 8 defines the interface only)");
  }
  async getCallOutcome(): Promise<CallOutcome | null> {
    throw new Error("No calling provider is configured yet (Phase 8 defines the interface only)");
  }
}

let activeProvider: CallingProvider = new NotConfiguredCallingProvider();

export function setCallingProvider(provider: CallingProvider): void {
  activeProvider = provider;
}

export function getCallingProvider(): CallingProvider {
  return activeProvider;
}
