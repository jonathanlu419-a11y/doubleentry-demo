import { Router } from 'express';
import { z } from 'zod';
import { shortcutRepo, type ShortcutInput } from '../repositories/shortcutRepo';
import { ah, parseId, badRequest } from './util';

const shortcutSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(60),
  icon: z.string().trim().max(40).nullish(),
  kind: z.enum(['expense', 'income', 'transfer', 'card_payment']),
  default_account_id: z.number().int().positive().nullish(),
  default_counter_account_id: z.number().int().positive().nullish(),
  default_category_id: z.number().int().positive().nullish(),
  default_income_source_id: z.number().int().positive().nullish(),
});

const reorderSchema = z.object({ ids: z.array(z.number().int().positive()) });

export const shortcutsRouter = Router();

shortcutsRouter.get('/shortcuts', ah(async (req, res) => {
  res.json(await shortcutRepo.list(req.sessionId));
}));

shortcutsRouter.post('/shortcuts', ah(async (req, res) => {
  const parsed = shortcutSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
  res.status(201).json(await shortcutRepo.create(req.sessionId, parsed.data as ShortcutInput));
}));

// Reorder must be registered before '/shortcuts/:id' so 'reorder' isn't parsed as an id.
shortcutsRouter.post('/shortcuts/reorder', ah(async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
  await shortcutRepo.reorder(req.sessionId, parsed.data.ids);
  res.json({ ok: true });
}));

shortcutsRouter.put('/shortcuts/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badRequest(res, 'Invalid id');
  const parsed = shortcutSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
  const row = await shortcutRepo.update(req.sessionId, id, parsed.data as ShortcutInput);
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json(row);
}));

shortcutsRouter.delete('/shortcuts/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badRequest(res, 'Invalid id');
  await shortcutRepo.remove(req.sessionId, id);
  res.json({ ok: true });
}));
