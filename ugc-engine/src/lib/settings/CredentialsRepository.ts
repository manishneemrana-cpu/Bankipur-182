import { withTenant } from "@/lib/db/client";
import { ALL_CREDENTIAL_KEYS } from "./credentialCatalog";

function encryptionKey(): string {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) throw new Error("APP_ENCRYPTION_KEY is not set — required to store/read API credentials.");
  return key;
}

export const CredentialsRepository = {
  /** All stored (decrypted) values for an org, as a plain key->value map. Empty values are never stored. */
  async getAll(organizationId: string): Promise<Record<string, string>> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query<{ credential_key: string; value: string }>(
        `SELECT credential_key, pgp_sym_decrypt(value_encrypted, $2) AS value FROM api_credentials WHERE organization_id = $1`,
        [organizationId, encryptionKey()]
      );
      return Object.fromEntries(rows.map((r) => [r.credential_key, r.value]));
    });
  },

  /** Same as getAll but masks secret values to "set (…last4)" — safe to send to the browser. */
  async getAllMasked(organizationId: string, secretKeys: Set<string>): Promise<Record<string, { set: boolean; preview?: string }>> {
    const values = await this.getAll(organizationId);
    const result: Record<string, { set: boolean; preview?: string }> = {};
    for (const key of ALL_CREDENTIAL_KEYS) {
      const value = values[key];
      if (!value) {
        result[key] = { set: false };
      } else if (secretKeys.has(key)) {
        result[key] = { set: true, preview: `••••${value.slice(-4)}` };
      } else {
        result[key] = { set: true, preview: value };
      }
    }
    return result;
  },

  /** Upserts a batch of key->value pairs; a blank/undefined value deletes that key instead. */
  async setMany(organizationId: string, values: Record<string, string>): Promise<void> {
    await withTenant(organizationId, async (client) => {
      for (const [key, value] of Object.entries(values)) {
        if (!ALL_CREDENTIAL_KEYS.includes(key)) continue;
        if (!value) {
          await client.query(`DELETE FROM api_credentials WHERE organization_id = $1 AND credential_key = $2`, [organizationId, key]);
          continue;
        }
        await client.query(
          `INSERT INTO api_credentials (organization_id, credential_key, value_encrypted)
           VALUES ($1, $2, pgp_sym_encrypt($3, $4))
           ON CONFLICT (organization_id, credential_key)
           DO UPDATE SET value_encrypted = pgp_sym_encrypt($3, $4), updated_at = now()`,
          [organizationId, key, value, encryptionKey()]
        );
      }
    });
  },
};
