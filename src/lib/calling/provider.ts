import "server-only";

export class CallingProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "No outbound calling credentials configured (e.g. for the Aman voice agent). Even once configured, assertLiveActionAllowed still requires LIVE mode and explicit approval before any call is placed.",
    );
  }
}

export interface CallingProvider {
  readonly name: string;
  isConfigured(): boolean;
  placeCall(params: { toPhone: string; leadId: string }): Promise<{ callId: string }>;
}

/**
 * No calling API credentials exist in this build. Per VOICE SAFETY in the
 * master spec: Lead -> Call Proposal -> Human Approval -> Calling API ->
 * Call -> Disposition -> CRM. This class is the "Calling API" box, and it
 * fails closed unconditionally until a real provider is wired up.
 */
class UnconfiguredCallingProvider implements CallingProvider {
  readonly name = "unconfigured";

  isConfigured(): boolean {
    return false;
  }

  async placeCall(): Promise<never> {
    throw new CallingProviderNotConfiguredError();
  }
}

let cached: CallingProvider | null = null;

export function getCallingProvider(): CallingProvider {
  if (!cached) cached = new UnconfiguredCallingProvider();
  return cached;
}
