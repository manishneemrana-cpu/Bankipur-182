export interface StoredFile { url: string; path: string; size: number }
export interface Storage {
  /** Persist a file that currently lives at `tmpPath` under `objectPath` and return its public URL. */
  save(tmpPath: string, objectPath: string, contentType: string): Promise<StoredFile>;
}
