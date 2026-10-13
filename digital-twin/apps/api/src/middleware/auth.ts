import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Bearer-token guard for /api/admin. TODO(prod hardening): swap for Supabase Auth JWT verification + per-user roles. */
export function requireAdmin(token: string): RequestHandler {
  const expected = digest(token);
  return (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.header('authorization') ?? '');
    if (m && timingSafeEqual(digest(m[1]!), expected)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  };
}
