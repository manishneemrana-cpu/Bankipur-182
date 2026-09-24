import type { IStorageProviderAdapter } from "./StorageProviderInterface";
import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { S3StorageAdapter } from "./S3StorageAdapter";
import { MockStorageAdapter } from "./MockStorageAdapter";

let cached: IStorageProviderAdapter | null = null;

export function getStorageProvider(): IStorageProviderAdapter {
  if (cached) return cached;

  if (process.env.STORAGE_PROVIDER === "s3") {
    cached = new S3StorageAdapter({
      bucket: process.env.S3_BUCKET || "",
      region: process.env.S3_REGION || "auto",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      endpoint: process.env.S3_ENDPOINT,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    });
  } else if (process.env.ALLOW_MOCK_PROVIDERS === "true") {
    // Explicit opt-in for a testing deploy on a read-only/serverless filesystem
    // (e.g. Vercel), where LocalStorageAdapter's disk writes would fail.
    cached = new MockStorageAdapter();
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      "STORAGE_PROVIDER=local is not allowed in production. Configure S3/R2, or set " +
        "ALLOW_MOCK_PROVIDERS=true for a testing deploy."
    );
  } else {
    cached = new LocalStorageAdapter();
  }

  return cached;
}

export type { IStorageProviderAdapter, UploadResult } from "./StorageProviderInterface";
