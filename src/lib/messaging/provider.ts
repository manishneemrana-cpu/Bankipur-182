import "server-only";

export type MessageChannel = "whatsapp" | "email" | "sms";

export class MessagingProviderNotConfiguredError extends Error {
  constructor(channel: MessageChannel) {
    super(
      `No ${channel} sending credentials configured. Set the channel-specific env vars to enable - even then, assertLiveActionAllowed still gates every send.`,
    );
  }
}

export interface MessagingProvider {
  readonly name: string;
  isConfigured(channel: MessageChannel): boolean;
  send(params: {
    channel: MessageChannel;
    to: string;
    body: string;
  }): Promise<{ externalMessageId: string }>;
}

/**
 * No WhatsApp Business API / email / SMS credentials exist in this
 * build. Every call fails closed. Covers the Buyer/Seller Relationship,
 * Site Visit Coordinator, and WhatsApp SaaS Onboarding worker agents'
 * eventual send path - none of them may ever call this directly without
 * going through assertLiveActionAllowed first.
 */
class UnconfiguredMessagingProvider implements MessagingProvider {
  readonly name = "unconfigured";

  isConfigured(): boolean {
    return false;
  }

  async send(params: { channel: MessageChannel }): Promise<never> {
    throw new MessagingProviderNotConfiguredError(params.channel);
  }
}

let cached: MessagingProvider | null = null;

export function getMessagingProvider(): MessagingProvider {
  if (!cached) cached = new UnconfiguredMessagingProvider();
  return cached;
}
