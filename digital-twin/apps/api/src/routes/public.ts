import { AnalyticsEventInput } from '@dt/shared-types';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { wrap } from '../util.js';
import type { Deps } from '../app.js';
import { HttpError } from '../services/repo.js';

export function publicRoutes({ repo }: Deps) {
  const r = Router();

  r.get('/projects/:slug', wrap(async (req, res) => {
    const p = await repo.projectBySlug(String(req.params.slug));
    if (!p || !p.is_published) throw new HttpError(404, 'Project not found');
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.json(await repo.bundle(p));
  }));

  r.post('/projects/:slug/events',
    rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false }),
    wrap(async (req, res) => {
      const p = await repo.projectBySlug(String(req.params.slug));
      if (!p || !p.is_published) throw new HttpError(404, 'Project not found');
      const body = AnalyticsEventInput.parse(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
      await repo.db.insert('analytics_events', {
        project_id: p.id, type: body.type, session_id: body.session_id, tower_id: body.tower_id ?? null,
        floor_number: body.floor_number ?? null, unit_id: body.unit_id ?? null, hotspot_id: body.hotspot_id ?? null, meta: body.meta ?? null,
      });
      res.status(204).end();
    }));

  return r;
}
