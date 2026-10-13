import { config } from "../config.js";
import { log } from "./logger.js";

/** Thrown when a REAL paid API call is requested but its implementation hasn't been confirmed/enabled yet. */
export class PaidApiNotImplemented extends Error {
  constructor(provider: string) {
    super(
      `${provider}: PAID_APIS_ENABLED=true and a key is set, but the live call is still a TODO(paid-api) stub. ` +
        `Confirm the key is ready and implement the marked block, or set PAID_APIS_ENABLED=false to use mock output.`,
    );
  }
}

/**
 * Single choke point for every paid third-party call.
 *  - "mock": adapter must return mock output (default; no network, no cost)
 *  - "live": adapter may call the real API
 */
export function paidGate(provider: string, apiKey: string): "mock" | "live" {
  if (!config.PAID_APIS_ENABLED) return "mock";
  if (!apiKey) {
    log.warn({ provider }, "PAID_APIS_ENABLED but API key is empty; falling back to mock");
    return "mock";
  }
  return "live";
}
