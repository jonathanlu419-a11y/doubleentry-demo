import { Router } from 'express';
import { z } from 'zod';
import { categoryRepo, incomeSourceRepo } from '../repositories/lookupRepo';
import { ah, parseId, badRequest } from './util';

const nameSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(100) });

type LookupRepo = typeof categoryRepo;

/** Build a CRUD router for a name-only lookup table (categories, income sources). */
function makeLookupRouter(path: string, repo: LookupRepo): Router {
  const router = Router();

  router.get(`/${path}`, ah(async (req, res) => {
    res.json(await repo.list(req.sessionId));
  }));

  router.post(`/${path}`, ah(async (req, res) => {
    const parsed = nameSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
    res.status(201).json(await repo.create(req.sessionId, parsed.data.name));
  }));

  router.put(`/${path}/:id`, ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, 'Invalid id');
    const parsed = nameSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
    const row = await repo.update(req.sessionId, id, parsed.data.name);
    if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json(row);
  }));

  router.delete(`/${path}/:id`, ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, 'Invalid id');
    await repo.remove(req.sessionId, id);
    res.json({ ok: true });
  }));

  return router;
}

export const categoriesRouter = makeLookupRouter('categories', categoryRepo);
export const incomeSourcesRouter = makeLookupRouter('income-sources', incomeSourceRepo);
