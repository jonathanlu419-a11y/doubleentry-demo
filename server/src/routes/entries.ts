import { Router } from 'express';
import { z } from 'zod';
import { entryRepo, type EntryInput } from '../repositories/entryRepo';
import { validateBalanced } from '../domain/balance';
import { ah, parseId, badRequest } from './util';

const lineSchema = z.object({
  account_id: z.number().int().positive(),
  side: z.enum(['debit', 'credit']),
  amount_cents: z.number().int().positive(),
});

const entrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().trim().max(200).nullish(),
  payee: z.string().trim().max(120).nullish(),
  category_id: z.number().int().positive().nullish(),
  income_source_id: z.number().int().positive().nullish(),
  lines: z.array(lineSchema).min(2, 'An entry needs at least two lines.').max(20),
});

/** Validate balance + tenant ownership; returns an error string or null. */
async function validate(sessionId: string, dto: EntryInput): Promise<string | null> {
  const balanceErr = validateBalanced(dto.lines);
  if (balanceErr) return balanceErr;
  return entryRepo.checkOwnership(sessionId, {
    accountIds: dto.lines.map((l) => l.account_id),
    categoryId: dto.category_id,
    incomeSourceId: dto.income_source_id,
  });
}

export const entriesRouter = Router();

entriesRouter.get('/entries', ah(async (req, res) => {
  res.json(await entryRepo.list(req.sessionId));
}));

entriesRouter.get('/entries/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badRequest(res, 'Invalid id');
  const row = await entryRepo.getById(req.sessionId, id);
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json(row);
}));

entriesRouter.post('/entries', ah(async (req, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
  const err = await validate(req.sessionId, parsed.data as EntryInput);
  if (err) return badRequest(res, err);
  res.status(201).json(await entryRepo.create(req.sessionId, parsed.data as EntryInput));
}));

entriesRouter.put('/entries/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badRequest(res, 'Invalid id');
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
  const err = await validate(req.sessionId, parsed.data as EntryInput);
  if (err) return badRequest(res, err);
  const row = await entryRepo.update(req.sessionId, id, parsed.data as EntryInput);
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json(row);
}));

// Bulk CSV import. Each row is validated and inserted independently — one bad row
// reports an error at its index but never aborts the batch (per-row isolation).
const importSchema = z.object({ entries: z.array(entrySchema).min(1).max(1000) });

entriesRouter.post('/entries/import', ah(async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);

  let imported = 0;
  const errors: { index: number; error: string }[] = [];
  for (let i = 0; i < parsed.data.entries.length; i++) {
    const dto = parsed.data.entries[i] as EntryInput;
    try {
      const err = await validate(req.sessionId, dto);
      if (err) {
        errors.push({ index: i, error: err });
        continue;
      }
      await entryRepo.create(req.sessionId, dto);
      imported++;
    } catch (e) {
      errors.push({ index: i, error: (e as Error).message });
    }
  }
  res.json({ imported, errors });
}));

entriesRouter.delete('/entries/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badRequest(res, 'Invalid id');
  const ok = await entryRepo.remove(req.sessionId, id);
  if (!ok) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true });
}));
