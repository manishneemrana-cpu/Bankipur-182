import type { IStorageProviderAdapter } from "./StorageProviderInterface";
import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { S3StorageAdapter } from "./S3StorageAdapter";
import { MockStorageAdapter } from "./MockStorageAdapter";
import { resolveEnv, type EnvOverrides } from "@/lib/settings/resolveEnv";

export function getStorageProvider(overrides: EnvOverrides = {}): IStorageProviderAdapter {
  const env = (key: string) => resolveEnv(overrides, key);

  if (env("STORAGE_PROVIDER") === "s3") {
    return new S3StorageAdapter({
      bucket: env("S3_BUCKET") || "",
      region: env("S3_REGION") || "auto",
      accessKeyId: env("S3_ACCESS_KEY_ID") || "",
      secretAccessKey: env("S3_SECRET_ACCESS_KEY") || "",
      endpoint: env("S3_ENDPOINT"),
      publicBaseUrl: env("S3_PUBLIC_BASE_URL"),
    });
  }

  if (env("ALLOW_MOCK_PROVIDERS") === "true") {
    // Explicit opt-in for a testing deploy on a read-only/serverless filesystem
    // (e.g. Vercel), where LocalStorageAdapter's disk writes would fail.
    return new MockStorageAdapter();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "STORAGE_PROVIDER=local is not allowed in production. Configure S3/R2, or set " +
        "ALLOW_MOCK_PROVIDERS=true for a testing deploy."
    );
  }

  return new LocalStorageAdapter();
}

export type { IStorageProviderAdapter, UploadResult } from "./StorageProviderInterface";
