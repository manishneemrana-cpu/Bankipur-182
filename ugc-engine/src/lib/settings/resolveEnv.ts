import { CredentialsRepository } from "./CredentialsRepository";

export type EnvOverrides = Record<string, string>;

/** DB-stored per-organization credentials, layered over process.env by every provider registry's `env()` reads. */
export async function getCredentialOverrides(organizationId: string): Promise<EnvOverrides> {
  try {
    return await CredentialsRepository.getAll(organizationId);
  } catch {
    // Settings table/encryption key not configured yet — fall back to env-only (pre-dashboard behavior).
    return {};
  }
}

/** A DB-stored value for `key` wins over the Vercel/`.env` value of the same name. */
export function resolveEnv(overrides: EnvOverrides, key: string): string | undefined {
  return overrides[key] || process.env[key];
}
