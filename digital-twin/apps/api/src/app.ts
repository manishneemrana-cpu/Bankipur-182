import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Config } from './config.js';
import type { Db } from './db/types.js';
import type { FloorPlanAnalysisProvider } from './floorplan/index.js';
import { requireAdmin } from './middleware/auth.js';
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import { Repo } from './services/repo.js';
import type { Storage } from './storage/types.js';
import { errorHandler } from './util.js';

export interface Deps { cfg: Config; repo: Repo; storage: Storage; floorplan: FloorPlanAnalysisProvider }

export function createApp(cfg: Config, db: Db, storage: Storage, floorplan: FloorPlanAnalysisProvider) {
  const deps: Deps = { cfg, repo: new Repo(db), storage, floorplan };
  const app = express();
  app.disable('x-powered-by');
  if (cfg.isProd) app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // GLBs/images are loaded cross-origin by the viewer
  app.use(cors({ origin: cfg.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], maxAge: 600 }));
  app.use(express.json({ limit: '256kb' }));
  app.use(express.text({ type: 'text/plain', limit: '16kb' })); // sendBeacon posts text/plain to avoid a CORS preflight

  app.get('/healthz', (_req, res) => void res.json({ ok: true }));
  // Locally stored files (dev/demo). With Supabase, URLs point at Storage and this simply serves the bundled sample.
  app.use('/files', express.static(cfg.storageDir, { maxAge: '1y', immutable: true, index: false }));

  app.use('/api/public', publicRoutes(deps));
  app.use('/api/admin', requireAdmin(cfg.adminToken), adminRoutes(deps));

  app.use((_req, res) => void res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler(cfg.isProd));
  return app;
}
