import { openAsBlob } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Storage } from './types.js';

/** Uploads to a PUBLIC Supabase Storage bucket. Streams from disk (Blob) so large GLBs don't sit in memory. */
export class SupabaseStorage implements Storage {
  constructor(private c: SupabaseClient, private bucket: string) {}
  async save(tmpPath: string, objectPath: string, contentType: string) {
    const blob = await openAsBlob(tmpPath, { type: contentType });
    const { error } = await this.c.storage.from(this.bucket).upload(objectPath, blob, { contentType, cacheControl: '31536000', upsert: false });
    await rm(tmpPath, { force: true });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
    const { data } = this.c.storage.from(this.bucket).getPublicUrl(objectPath);
    return { url: data.publicUrl, path: objectPath, size: blob.size };
  }
}
