import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './services/repo.js';

export const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

export function errorHandler(isProd: boolean) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return void res.status(400).json({ error: 'Validation failed', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
    const code = (err as { code?: string })?.code;
    if (code === 'conflict') return void res.status(409).json({ error: (err as Error).message || 'Conflict' });
    if (code === 'fk') return void res.status(409).json({ error: 'Still referenced by other records' });
    if (code === 'LIMIT_FILE_SIZE') return void res.status(413).json({ error: 'File too large' });
    if (err instanceof SyntaxError) return void res.status(400).json({ error: 'Malformed JSON' });
    console.error('[api] unhandled', err);
    res.status(500).json({ error: isProd ? 'Internal error' : String((err as Error)?.message ?? err) });
  };
}
