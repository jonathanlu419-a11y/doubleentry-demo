/**
 * The Express app, free of any listen() call, so it can run both ways:
 *  - long-running process: server/src/index.ts adds static serving + app.listen (local dev, Render)
 *  - serverless: /api/index.ts exports it as a Vercel function handler (an Express app IS a
 *    (req, res) handler). Static files are served by Vercel's CDN there, not by Express.
 * All routes, middleware, session logic, and the error handler live here unchanged.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { pool } from './db/pool';
import { sessionMiddleware } from './middleware/session';
import { sessionRouter } from './routes/session';
import { accountsRouter } from './routes/accounts';
import { categoriesRouter, incomeSourcesRouter } from './routes/lookups';
import { shortcutsRouter } from './routes/shortcuts';
import { entriesRouter } from './routes/entries';

export const app = express();

// Behind a TLS-terminating proxy (Render/Vercel) trust X-Forwarded-* headers.
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// CORS only matters in dev (client on :5173, server on :3001). Prod is same-origin.
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim());
if (corsOrigin && corsOrigin.length > 0) {
  app.use(cors({ origin: corsOrigin, credentials: true }));
}

// Health check — no session required; verifies DB connectivity.
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'down', error: (err as Error).message });
  }
});

// Everything below /api is session-scoped.
app.use('/api', sessionMiddleware);
app.use('/api', sessionRouter);
app.use('/api', accountsRouter);
app.use('/api', categoriesRouter);
app.use('/api', incomeSourcesRouter);
app.use('/api', shortcutsRouter);
app.use('/api', entriesRouter);

// Centralised error handler — repos/routes call next(err); we log and return 500.
// Exported (not registered here) because Express error handlers must be LAST in the
// stack: each entry point registers it after any layers it adds (e.g. static serving).
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: (err as Error)?.message ?? 'Internal error' });
}

export default app;
