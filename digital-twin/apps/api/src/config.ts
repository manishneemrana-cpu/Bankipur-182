import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export interface Config {
  port: number;
  isProd: boolean;
  adminToken: string;
  corsOrigins: string[];
  publicApiUrl: string;
  storageDir: string;
  dataFile: string;
  seedFile: string;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  bucket: string;
  floorplanProvider: string;
  cubicasaKey?: string;
  archilogicKey?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProd = env.NODE_ENV === 'production';
  let adminToken = env.ADMIN_API_TOKEN ?? '';
  if (!adminToken) {
    if (isProd) throw new Error('ADMIN_API_TOKEN must be set in production');
    adminToken = randomBytes(18).toString('hex');
    console.warn(`[api] ADMIN_API_TOKEN not set – generated a dev token for this run:\n      ${adminToken}`);
  } else if (isProd && adminToken.length < 24) {
    throw new Error('ADMIN_API_TOKEN must be at least 24 characters in production');
  }
  const port = Number(env.PORT ?? 8787);
  return {
    port,
    isProd,
    adminToken,
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(',').map((s) => s.trim()).filter(Boolean),
    publicApiUrl: (env.PUBLIC_API_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
    storageDir: env.STORAGE_DIR ? resolve(env.STORAGE_DIR) : resolve(apiRoot, 'storage'),
    dataFile: env.DATA_FILE ? resolve(env.DATA_FILE) : resolve(apiRoot, 'data', 'db.json'),
    seedFile: resolve(apiRoot, 'seed', 'sample-project.json'),
    supabaseUrl: env.SUPABASE_URL || undefined,
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY || undefined,
    bucket: env.SUPABASE_STORAGE_BUCKET ?? 'project-assets',
    floorplanProvider: env.FLOORPLAN_PROVIDER ?? 'mock',
    cubicasaKey: env.CUBICASA_API_KEY || undefined,
    archilogicKey: env.ARCHILOGIC_API_KEY || undefined,
  };
}
