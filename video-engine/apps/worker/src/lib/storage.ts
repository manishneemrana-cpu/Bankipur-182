import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config, useSupabase } from "../config.js";

export interface Storage {
  /** Upload bytes, return a publicly fetchable URL. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Resolve a URL previously returned by put() back to bytes (for stages that need local files). */
  fetchBytes(url: string): Promise<Buffer>;
}

class SupabaseStorage implements Storage {
  private sb = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  async put(key: string, data: Buffer, contentType: string) {
    const { error } = await this.sb.storage.from(config.SUPABASE_BUCKET).upload(key, data, { contentType, upsert: true });
    if (error) throw new Error(`Storage upload failed (${key}): ${error.message}`);
    return this.sb.storage.from(config.SUPABASE_BUCKET).getPublicUrl(key).data.publicUrl;
  }
  async fetchBytes(url: string) {
    return httpBytes(url);
  }
}

/** Local-disk storage, served by the API at /files. Dev/offline only. */
class LocalStorage implements Storage {
  root = path.join(config.LOCAL_DATA_DIR, "files");
  async put(key: string, data: Buffer) {
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const dest = path.join(this.root, safe);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);
    return `${config.PUBLIC_API_URL}/files/${safe.split(path.sep).map(encodeURIComponent).join("/")}`;
  }
  async fetchBytes(url: string) {
    const prefix = `${config.PUBLIC_API_URL}/files/`;
    if (url.startsWith(prefix)) {
      const rel = decodeURIComponent(url.slice(prefix.length));
      return fs.readFile(path.join(this.root, path.normalize(rel)));
    }
    return httpBytes(url);
  }
}

async function httpBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export const storage: Storage = useSupabase ? new SupabaseStorage() : new LocalStorage();
