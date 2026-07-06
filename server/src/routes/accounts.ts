import { Router } from 'express';
import { z } from 'zod';
import { accountRepo, type AccountInput } from '../repositories/accountRepo';
import { ah, parseId, badRequest } from './util';

const accountSchema = z.object({
  code: z.string().trim().max(20).nullish(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  nature: z.enum(['Asset', 'Liability', 'Revenue', 'Expense']),
  starting_balance_cents: z.number().int().min(-1e15).max(1e15).optional(),
});

export const accountsRouter = Router();

accountsRouter.get('/accounts', ah(async (req, res) => {
  res.json(await accountRepo.list(req.sessionId));
}));

// Registered before any '/accounts/:id' param route so 'balances' isn't parsed as an id.
accountsRouter.get('/accounts/balances', ah(async (req, res) => {
  res.json(await accountRepo.listWithBalances(req.sessionId));
}));

accountsRouter.post('/accounts', ah(async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
  res.status(201).json(await accountRepo.create(req.sessionId, parsed.data as AccountInput));
}));

accountsRouter.put('/accounts/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badRequest(res, 'Invalid id');
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
  const row = await accountRepo.update(req.sessionId, id, parsed.data as AccountInput);
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json(row);
}));

accountsRouter.delete('/accounts/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badRequest(res, 'Invalid id');
  if (await accountRepo.isReferenced(req.sessionId, id)) {
    return res
      .status(409)
      .json({ ok: false, error: 'This account is used by journal entries and cannot be deleted.' });
  }
  await accountRepo.remove(req.sessionId, id);
  res.json({ ok: true });
}));
