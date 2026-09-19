import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import type { IStorageProviderAdapter, UploadResult } from "./StorageProviderInterface";

/** Dev-only local-disk storage. Never used in production (S3/R2 required there). */
export class LocalStorageAdapter implements IStorageProviderAdapter {
  public providerName = "local-disk";
  private rootDir: string;

  constructor(rootDir = path.join(process.cwd(), ".local-storage")) {
    this.rootDir = rootDir;
  }

  public async upload(key: string, data: Buffer, _contentType: string): Promise<UploadResult> {
    const fullPath = path.join(this.rootDir, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return { url: `file://${fullPath}`, key, sizeBytes: data.byteLength };
  }

  public async getSignedUploadUrl(key: string): Promise<string> {
    return `file://${path.join(this.rootDir, key)}`;
  }

  public async getSignedReadUrl(key: string): Promise<string> {
    return `file://${path.join(this.rootDir, key)}`;
  }

  public async delete(key: string): Promise<void> {
    await unlink(path.join(this.rootDir, key)).catch(() => undefined);
  }
}
