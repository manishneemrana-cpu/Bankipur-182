import { describe, expect, it } from "vitest";

import {
  clientEnvSchema,
  parseEnv,
  required,
  serverEnvSchema,
} from "@/lib/env/schema";

describe("env schema", () => {
  it("boots with no variables set, applying defaults", () => {
    const env = parseEnv(serverEnvSchema, {});
    expect(env.PUBLIC_BASE_URL).toBe("http://localhost:3000");
    expect(env.STORAGE_BUCKET).toBe("project-files");
    expect(env.WHATSAPP_API_ADAPTER).toBe("none");
    expect(env.AI_API_KEY).toBeUndefined();
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv(serverEnvSchema, {
      AI_PROVIDER: "",
      PUBLIC_BASE_URL: "",
    });
    expect(env.AI_PROVIDER).toBeUndefined();
    expect(env.PUBLIC_BASE_URL).toBe("http://localhost:3000");
  });

  it("rejects invalid values and names the variable", () => {
    expect(() => parseEnv(serverEnvSchema, { AI_PROVIDER: "skynet" })).toThrow(
      /AI_PROVIDER/,
    );
    expect(() =>
      parseEnv(clientEnvSchema, { NEXT_PUBLIC_SUPABASE_URL: "not a url" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("client schema never exposes server-only keys", () => {
    const env = parseEnv(clientEnvSchema, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
      AI_API_KEY: "secret",
    });
    expect(Object.keys(env)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(Object.keys(env)).not.toContain("AI_API_KEY");
  });

  it("required() throws with the variable name when missing", () => {
    expect(() => required({}, "AI_API_KEY")).toThrow("AI_API_KEY");
    expect(required({ AI_API_KEY: "x" }, "AI_API_KEY")).toBe("x");
  });
});
