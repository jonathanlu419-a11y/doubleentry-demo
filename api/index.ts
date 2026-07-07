/**
 * Vercel serverless entry point. An Express app is itself a (req, res) handler, so we
 * export the shared app unchanged — routes, session middleware, and cookie handling all
 * come from server/src/app.ts. Static files are served by Vercel's CDN (vercel.json),
 * so unlike server/src/index.ts no static/SPA layer is added here.
 */
import '../server/src/types/express'; // Request.sessionId global augmentation
import { app, errorHandler } from '../server/src/app';

app.use(errorHandler);

export default app;
