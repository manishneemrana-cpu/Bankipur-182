import "server-only";

export class SocialProviderNotConfiguredError extends Error {
  constructor(platform: string) {
    super(
      `No social publishing credentials configured for "${platform}". Set the platform-specific env vars to enable - even then, assertLiveActionAllowed still gates every publish.`,
    );
  }
}

export interface SocialProvider {
  readonly name: string;
  isConfigured(platform: string): boolean;
  publish(params: { platform: string; caption: string }): Promise<{ externalPostId: string }>;
}

/**
 * No social platform credentials exist in this build. This class exists
 * so the factory always returns something with the right shape; every
 * call fails closed rather than silently succeeding or scraping/faking a
 * post. A real implementation (Meta Graph API, LinkedIn API, etc.) is a
 * future, explicitly-approved integration - not guessed at here.
 */
class UnconfiguredSocialProvider implements SocialProvider {
  readonly name = "unconfigured";

  isConfigured(): boolean {
    return false;
  }

  async publish(params: { platform: string }): Promise<never> {
    throw new SocialProviderNotConfiguredError(params.platform);
  }
}

let cached: SocialProvider | null = null;

export function getSocialProvider(): SocialProvider {
  if (!cached) cached = new UnconfiguredSocialProvider();
  return cached;
}
