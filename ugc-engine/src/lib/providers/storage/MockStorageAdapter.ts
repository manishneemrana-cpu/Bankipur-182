import type { IStorageProviderAdapter, UploadResult } from "./StorageProviderInterface";

/**
 * No-disk, no-network stand-in for object storage. Used for a "testing
 * deploy" (ALLOW_MOCK_PROVIDERS=true) on a read-only/serverless filesystem
 * such as Vercel, where LocalStorageAdapter's disk writes would fail.
 * Never selected unless ALLOW_MOCK_PROVIDERS is explicitly set — see
 * getStorageProvider().
 */
export class MockStorageAdapter implements IStorageProviderAdapter {
  public providerName = "mock-storage";

  public async upload(key: string, data: Buffer): Promise<UploadResult> {
    return { url: `https://mock-storage.local/${key}`, key, sizeBytes: data.byteLength };
  }

  public async getSignedUploadUrl(key: string): Promise<string> {
    return `https://mock-storage.local/${key}`;
  }

  public async getSignedReadUrl(key: string): Promise<string> {
    return `https://mock-storage.local/${key}`;
  }

  public async delete(_key: string): Promise<void> {
    return;
  }
}
