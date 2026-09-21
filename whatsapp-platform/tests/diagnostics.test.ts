import "dotenv/config";
import { describe, expect, it } from "vitest";
import { getSystemDiagnostics } from "@/server/diagnostics";

describe("system diagnostics", () => {
  it("reports database ok, mock-mode flags, and non-negative counts against the real database", async () => {
    const diag = await getSystemDiagnostics();

    expect(diag.database).toBe("ok");
    expect(typeof diag.mockMeta).toBe("boolean");
    expect(typeof diag.mockPayments).toBe("boolean");
    expect(diag.migrations.count).toBeGreaterThan(0);
    expect(diag.migrations.applied).toContain("0001_init.sql");
    expect(diag.counts.organizations).toBeGreaterThanOrEqual(0);
    expect(diag.counts.users).toBeGreaterThanOrEqual(0);
    expect(diag.webhookEvents.last24h).toBeGreaterThanOrEqual(0);
    expect(diag.outboundWebhookDeliveries.last24hSucceeded).toBeGreaterThanOrEqual(0);
    expect(diag.outboundWebhookDeliveries.last24hFailed).toBeGreaterThanOrEqual(0);
  });
});
