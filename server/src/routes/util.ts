import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wrap an async route so thrown/rejected errors reach the central error handler. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Parse a numeric :id param; returns null if not a positive integer. */
export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Send a 400 with a message. */
export function badRequest(res: Response, message: string): void {
  res.status(400).json({ ok: false, error: message });
}
