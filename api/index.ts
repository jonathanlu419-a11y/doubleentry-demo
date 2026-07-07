/**
 * Vercel serverless entry point. An Express app is itself a (req, res) handler, so we
 * export the shared app unchanged — routes, session middleware, and cookie handling all
 * come from server/src/app.ts. Static files are served by Vercel's CDN (vercel.json),
 * so unlike server/src/index.ts no static/SPA layer is added here.
 */
/// <reference path="../server/src/types/express.d.ts" />
// ^ Request.sessionId global augmentation — a types-only directive, NOT an import:
//   a bare `import '../server/src/types/express'` survives transpilation as a runtime
//   require() of a .js that doesn't exist and crashes the function (verified on Vercel).
import { app, errorHandler } from '../server/src/app';

app.use(errorHandler);

export default app;
