import type { IStorageProviderAdapter, UploadResult } from "./StorageProviderInterface";

export interface S3AdapterConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // set for Cloudflare R2
}

/**
 * S3-compatible adapter (works for AWS S3 or Cloudflare R2 via `endpoint`).
 * Uses presigned URLs via the AWS SDK v3 at the call site's discretion;
 * the actual @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner packages
 * are intentionally left as a peer dependency to avoid bloating installs
 * for teams that only need LocalStorageAdapter in development.
 */
export class S3StorageAdapter implements IStorageProviderAdapter {
  public providerName = "s3-compatible";

  constructor(private config: S3AdapterConfig) {}

  public async upload(_key: string, _data: Buffer, _contentType: string): Promise<UploadResult> {
    throw new Error(
      "S3StorageAdapter.upload requires @aws-sdk/client-s3 to be installed and configured. " +
        "Install it and implement PutObjectCommand here before enabling STORAGE_PROVIDER=s3 in production."
    );
  }

  public async getSignedUploadUrl(_key: string, _contentType: string): Promise<string> {
    throw new Error("S3StorageAdapter.getSignedUploadUrl requires @aws-sdk/s3-request-presigner.");
  }

  public async getSignedReadUrl(_key: string): Promise<string> {
    throw new Error("S3StorageAdapter.getSignedReadUrl requires @aws-sdk/s3-request-presigner.");
  }

  public async delete(_key: string): Promise<void> {
    throw new Error("S3StorageAdapter.delete requires @aws-sdk/client-s3.");
  }
}
