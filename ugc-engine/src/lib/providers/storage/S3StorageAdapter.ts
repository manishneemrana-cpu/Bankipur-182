import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { IStorageProviderAdapter, UploadResult } from "./StorageProviderInterface";

export interface S3AdapterConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // set for Cloudflare R2
  publicBaseUrl?: string; // e.g. an R2 public bucket URL or CDN in front of it
}

/**
 * S3-compatible adapter — works against AWS S3 or Cloudflare R2 (pass
 * `endpoint` + `region: "auto"` for R2). Used for any deploy that needs
 * generated assets to survive past the process that rendered them
 * (a serverless request, an ephemeral CI runner, a restarted worker).
 */
export class S3StorageAdapter implements IStorageProviderAdapter {
  public providerName = "s3-compatible";
  private client: S3Client;

  constructor(private config: S3AdapterConfig) {
    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error(
        "S3StorageAdapter requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY to be set."
      );
    }
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: Boolean(config.endpoint),
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  public async upload(key: string, data: Buffer, contentType: string): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: data, ContentType: contentType })
    );
    const url = this.config.publicBaseUrl
      ? `${this.config.publicBaseUrl.replace(/\/$/, "")}/${key}`
      : await this.getSignedReadUrl(key);
    return { url, key, sizeBytes: data.byteLength };
  }

  public async getSignedUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  public async getSignedReadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.config.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 3600 * 24 * 7 });
  }

  public async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}
