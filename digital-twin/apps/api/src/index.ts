import 'dotenv/config';
import { loadConfig } from './config.js';
import { FileDb } from './db/fileDb.js';
import { SupabaseDb } from './db/supabaseDb.js';
import type { Db } from './db/types.js';
import { createApp } from './app.js';
import { createFloorPlanProvider } from './floorplan/index.js';
import { LocalStorage } from './storage/local.js';
import { SupabaseStorage } from './storage/supabase.js';
import type { Storage } from './storage/types.js';

const cfg = loadConfig();
let db: Db, storage: Storage;
if (cfg.supabaseUrl && cfg.supabaseServiceKey) {
  const sb = new SupabaseDb(cfg.supabaseUrl, cfg.supabaseServiceKey);
  db = sb;
  storage = new SupabaseStorage(sb.client, cfg.bucket);
  console.log('[api] using Supabase (db + storage)');
} else {
  if (cfg.isProd) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required in production');
  db = await FileDb.open(cfg.dataFile, cfg.seedFile);
  storage = new LocalStorage(cfg.storageDir, cfg.publicApiUrl);
  console.log(`[api] using local JSON store (${cfg.dataFile}) + disk uploads – dev/demo only`);
}

createApp(cfg, db, storage, createFloorPlanProvider(cfg)).listen(cfg.port, () =>
  console.log(`[api] listening on ${cfg.publicApiUrl}  (floorplan provider: ${cfg.floorplanProvider})`));
