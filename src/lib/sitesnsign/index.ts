import "server-only";

import type { SitesNSignConnector } from "./connector";
import { MockSitesNSignConnector } from "./mock-connector";
import { LiveSitesNSignConnector } from "./live-connector";

export type { SitesNSignConnector } from "./connector";
export { SitesNSignWriteDisabledError, SitesNSignNotConfiguredError } from "./connector";
export * from "./types";

let cached: SitesNSignConnector | null = null;

/**
 * DEMO and TEST modes always get the mock connector - zero external
 * calls, zero risk to production. A live connector is only selected once
 * both SITESNSIGN_API_URL and SITESNSIGN_API_KEY are set. Its ping()
 * method is fully implemented and verified against the real API's
 * Swagger doc; other read methods use paths inferred from the real DTO
 * names and need verification (see live-connector.ts for exactly which).
 */
export function getSitesNSignConnector(): SitesNSignConnector {
  if (cached) return cached;

  cached =
    process.env.SITESNSIGN_API_URL && process.env.SITESNSIGN_API_KEY
      ? new LiveSitesNSignConnector()
      : new MockSitesNSignConnector();

  return cached;
}
