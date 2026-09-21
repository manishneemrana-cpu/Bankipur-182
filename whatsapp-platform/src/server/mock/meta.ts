import "server-only";
import { getEnv } from "@/server/env";

/**
 * MOCK_META gate for anything that must never behave as if it's talking to
 * real Meta infrastructure. Per the project rule, no fake data may ever
 * appear once MOCK_META is turned off.
 */
export function isMockModeEnabled(): boolean {
  return getEnv().MOCK_META;
}
