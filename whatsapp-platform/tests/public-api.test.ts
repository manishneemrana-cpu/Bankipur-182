import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import { GET as getContacts, POST as postContacts } from "@/app/api/v1/contacts/route";
import { GET as getLeads, POST as postLeads } from "@/app/api/v1/leads/route";
import { createApiKey } from "@/server/api-keys";
import { withPlatformAdminTransaction } from "@/server/db";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let orgAId: string;
let orgBId: string;
let userId: string;
let fullAccessKey: string;
let readOnlyKey: string;
let orgBKey: string;

function req(url: string, init: { method?: string; body?: unknown; apiKey?: string | null } = {}) {
  const headers = new Headers();
  if (init.apiKey !== null) headers.set("authorization", `Bearer ${init.apiKey ?? fullAccessKey}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

beforeAll(async () => {
  const orgA = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Public API Test Org A') RETURNING id");
  orgAId = orgA.rows[0]!.id;
  const orgB = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Public API Test Org B') RETURNING id");
  orgBId = orgB.rows[0]!.id;
  const user = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('public-api-test@example.com', 'x', 'Tester') RETURNING id"
  );
  userId = user.rows[0]!.id;
  await adminPool.query(
    "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
    [orgAId, userId]
  );

  fullAccessKey = (await createApiKey(orgAId, userId, "full", ["contacts.read", "contacts.write", "leads.read", "leads.write"])).rawKey;
  readOnlyKey = (await createApiKey(orgAId, userId, "read-only", ["contacts.read"])).rawKey;
  orgBKey = (await createApiKey(orgBId, userId, "org-b", ["contacts.read", "contacts.write", "leads.read", "leads.write"])).rawKey;
});

afterAll(async () => {
  await withPlatformAdminTransaction((client) =>
    client.query("DELETE FROM organizations WHERE id IN ($1, $2)", [orgAId, orgBId])
  );
  await adminPool.query("DELETE FROM users WHERE id = $1", [userId]);
  await adminPool.end();
});

describe("public API auth", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await getContacts(req("http://localhost/api/v1/contacts", { apiKey: null }));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid API key", async () => {
    const res = await getContacts(req("http://localhost/api/v1/contacts", { apiKey: "wap_not_real" }));
    expect(res.status).toBe(401);
  });

  it("rejects a key lacking the required scope", async () => {
    const res = await postContacts(
      req("http://localhost/api/v1/contacts", { method: "POST", apiKey: readOnlyKey, body: { phoneE164: "+919876543210" } })
    );
    expect(res.status).toBe(403);
  });
});

describe("public API contacts", () => {
  it("creates a contact and then lists it", async () => {
    const createRes = await postContacts(
      req("http://localhost/api/v1/contacts", { method: "POST", apiKey: fullAccessKey, body: { phoneE164: "+919876500001", name: "API Contact" } })
    );
    expect(createRes.status).toBe(201);

    const listRes = await getContacts(req("http://localhost/api/v1/contacts", { apiKey: fullAccessKey }));
    expect(listRes.status).toBe(200);
    const body = await listRes.json();
    expect(body.data.some((c: { phone_e164: string }) => c.phone_e164 === "+919876500001")).toBe(true);
  });

  it("rejects an invalid phone number with 400", async () => {
    const res = await postContacts(
      req("http://localhost/api/v1/contacts", { method: "POST", apiKey: fullAccessKey, body: { phoneE164: "not-a-phone" } })
    );
    expect(res.status).toBe(400);
  });

  it("does not leak org A's contacts to org B's key", async () => {
    const listRes = await getContacts(req("http://localhost/api/v1/contacts", { apiKey: orgBKey }));
    const body = await listRes.json();
    expect(body.data.some((c: { phone_e164: string }) => c.phone_e164 === "+919876500001")).toBe(false);
  });
});

describe("public API leads", () => {
  it("creates a lead and then lists it", async () => {
    const createRes = await postLeads(
      req("http://localhost/api/v1/leads", { method: "POST", apiKey: fullAccessKey, body: { name: "API Lead" } })
    );
    expect(createRes.status).toBe(201);

    const listRes = await getLeads(req("http://localhost/api/v1/leads", { apiKey: fullAccessKey }));
    const body = await listRes.json();
    expect(body.data.some((l: { name: string }) => l.name === "API Lead")).toBe(true);
  });
});
