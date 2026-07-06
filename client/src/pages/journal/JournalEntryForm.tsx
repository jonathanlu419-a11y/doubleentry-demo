import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { useAccounts, useCategories, useIncomeSources, useSaveEntry, type EntryInput } from '../../api/hooks';
import type { JournalEntry, Side } from '../../api/types';
import { formatCents, dollarsToCents } from '../../lib/money';

type DraftLine = { account_id: number | null; side: Side; amount: string };

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function initLines(entry: JournalEntry | null): DraftLine[] {
  if (!entry) {
    return [
      { account_id: null, side: 'debit', amount: '' },
      { account_id: null, side: 'credit', amount: '' },
    ];
  }
  return entry.lines.map((l) => ({ account_id: l.account_id, side: l.side, amount: (l.amount_cents / 100).toFixed(2) }));
}

export default function JournalEntryForm({ entry, onClose }: { entry: JournalEntry | null; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: incomeSources = [] } = useIncomeSources();
  const save = useSaveEntry();

  const [date, setDate] = useState(entry?.entry_date ?? todayISO());
  const [description, setDescription] = useState(entry?.description ?? '');
  const [payee, setPayee] = useState(entry?.payee ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(entry?.category_id ?? null);
  const [incomeSourceId, setIncomeSourceId] = useState<number | null>(entry?.income_source_id ?? null);
  const [lines, setLines] = useState<DraftLine[]>(initLines(entry));
  const [error, setError] = useState<string | null>(null);

  const { debitCents, creditCents, balanced, allValid } = useMemo(() => {
    let d = 0;
    let c = 0;
    let valid = lines.length >= 2;
    for (const l of lines) {
      const cents = dollarsToCents(l.amount);
      if (l.account_id == null || cents == null || cents <= 0) valid = false;
      if (cents && cents > 0) {
        if (l.side === 'debit') d += cents;
        else c += cents;
      }
    }
    return { debitCents: d, creditCents: c, balanced: d === c && d > 0, allValid: valid };
  }, [lines]);

  const canSave = balanced && allValid && !save.isPending;

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { account_id: null, side: 'debit', amount: '' }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function submit() {
    const data: EntryInput = {
      entry_date: date,
      description: description.trim() || null,
      payee: payee.trim() || null,
      category_id: categoryId,
      income_source_id: incomeSourceId,
      lines: lines.map((l) => ({ account_id: l.account_id as number, side: l.side, amount_cents: dollarsToCents(l.amount) as number })),
    };
    try {
      await save.mutateAsync({ id: entry?.id, data });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const diff = debitCents - creditCents;

  return (
    <Modal
      title={entry ? 'Edit journal entry' : 'New journal entry'}
      onClose={onClose}
      footer={
        <>
          <div className={`balance-chip ${balanced ? 'ok' : 'bad'}`}>
            {balanced ? 'Balanced' : `Off by ${formatCents(Math.abs(diff))}`}
          </div>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={!canSave} title={!balanced ? 'Debits must equal credits' : ''}>
            {save.isPending ? 'Saving…' : 'Save entry'}
          </button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}

      <div className="row2">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Payee (optional)</span>
          <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Acme Corp" />
        </label>
      </div>
      <label className="field">
        <span>Description</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this?" />
      </label>
      <div className="row2">
        <label className="field">
          <span>Category (optional)</span>
          <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Income source (optional)</span>
          <select value={incomeSourceId ?? ''} onChange={(e) => setIncomeSourceId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— None —</option>
            {incomeSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <div className="lines-head">
        <span>Lines</span>
        <button className="btn ghost sm" onClick={addLine}><Plus size={14} /> Add line</button>
      </div>
      <table className="lines-table">
        <thead>
          <tr><th>Account</th><th>Side</th><th className="right">Amount</th><th></th></tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>
                <select value={l.account_id ?? ''} onChange={(e) => setLine(i, { account_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— Select —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </td>
              <td>
                <select value={l.side} onChange={(e) => setLine(i, { side: e.target.value as Side })}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </td>
              <td className="right">
                <input className="amount" inputMode="decimal" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="0.00" />
              </td>
              <td>
                <button className="icon-btn danger" onClick={() => removeLine(i)} disabled={lines.length <= 2} aria-label="Remove line"><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="muted">Totals</td>
            <td className="right mono">
              <div>Dr {formatCents(debitCents)}</div>
              <div>Cr {formatCents(creditCents)}</div>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  );
}
