/**
 * Long-running entry point (local dev + Render): takes the shared Express app, adds
 * static serving of the built client (single-origin combined deploy), and listens.
 * The Vercel serverless path (/api/index.ts) imports the app directly and skips this file.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { app, errorHandler } from './app';

const PORT = Number(process.env.PORT) || 3001;

// Production: serve the built client from the same origin (first-party cookies, no CORS).
// server/dist/index.js → ../../client/dist ; same relative path works from src via tsx.
const clientDist = resolve(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback for non-API GETs (React Router owns the paths).
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(resolve(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
