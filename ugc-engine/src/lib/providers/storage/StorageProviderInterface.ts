export interface UploadResult {
  url: string;
  key: string;
  sizeBytes: number;
}

export interface IStorageProviderAdapter {
  providerName: string;
  upload(key: string, data: Buffer, contentType: string): Promise<UploadResult>;
  getSignedUploadUrl(key: string, contentType: string): Promise<string>;
  getSignedReadUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
