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
 * SITESNSIGN_API_URL is set, and even then it currently fails closed
 * (see live-connector.ts) since no official API has been confirmed.
 */
export function getSitesNSignConnector(): SitesNSignConnector {
  if (cached) return cached;

  cached = process.env.SITESNSIGN_API_URL
    ? new LiveSitesNSignConnector()
    : new MockSitesNSignConnector();

  return cached;
}
