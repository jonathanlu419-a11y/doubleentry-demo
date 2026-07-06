import { useMemo, useState } from 'react';
import {
  Plus, ShoppingCart, Banknote, ArrowLeftRight, CreditCard, Zap, ChevronLeft,
  type LucideIcon,
} from 'lucide-react';
import Modal from './Modal';
import { useAccounts, useShortcuts, useSaveEntry, type EntryInput } from '../api/hooks';
import { SHORTCUT_KIND_LABELS, type Shortcut } from '../api/types';
import { dollarsToCents, formatCents } from '../lib/money';

// Small curated icon map for shortcut.icon names; anything unknown gets a neutral bolt.
const ICONS: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  banknote: Banknote,
  'arrow-left-right': ArrowLeftRight,
  'credit-card': CreditCard,
};
const iconFor = (name: string | null): LucideIcon => (name && ICONS[name]) || Zap;

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

type Draft = {
  shortcut: Shortcut;
  debitId: number | null;
  creditId: number | null;
  amount: string;
  date: string;
  payee: string;
  description: string;
};

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: shortcuts = [] } = useShortcuts();
  const { data: accounts = [] } = useAccounts();
  const save = useSaveEntry();

  const cents = draft ? dollarsToCents(draft.amount) : null;
  const valid = useMemo(
    () =>
      !!draft &&
      draft.debitId != null &&
      draft.creditId != null &&
      draft.debitId !== draft.creditId &&
      cents != null &&
      cents > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(draft.date),
    [draft, cents],
  );

  function pick(s: Shortcut) {
    setError(null);
    setDraft({
      shortcut: s,
      debitId: s.default_account_id,
      creditId: s.default_counter_account_id,
      amount: '',
      date: todayISO(),
      payee: '',
      description: s.label,
    });
  }

  function close() {
    setOpen(false);
    setDraft(null);
    setError(null);
  }

  async function submit() {
    if (!draft || !valid) return;
    const data: EntryInput = {
      entry_date: draft.date,
      description: draft.description.trim() || null,
      payee: draft.payee.trim() || null,
      category_id: draft.shortcut.default_category_id,
      income_source_id: draft.shortcut.default_income_source_id,
      lines: [
        { account_id: draft.debitId as number, side: 'debit', amount_cents: cents as number },
        { account_id: draft.creditId as number, side: 'credit', amount_cents: cents as number },
      ],
    };
    try {
      await save.mutateAsync({ data });
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="Quick add">
        <Plus size={22} />
      </button>

      {open && !draft && (
        <Modal title="Quick Add" onClose={close}>
          {shortcuts.length === 0 ? (
            <p className="muted">No shortcuts yet — create some under Settings → Shortcuts.</p>
          ) : (
            <div className="shortcut-grid">
              {shortcuts.map((s) => {
                const Icon = iconFor(s.icon);
                return (
                  <button key={s.id} className="shortcut-tile" onClick={() => pick(s)}>
                    <Icon size={22} />
                    <span className="tile-label">{s.label}</span>
                    <span className="tile-kind muted">{SHORTCUT_KIND_LABELS[s.kind]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {open && draft && (
        <Modal
          title={draft.shortcut.label}
          onClose={close}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDraft(null)}>
                <ChevronLeft size={15} /> Back
              </button>
              <button className="btn primary" onClick={submit} disabled={!valid || save.isPending}>
                {save.isPending ? 'Adding…' : `Add ${cents && cents > 0 ? formatCents(cents) : 'entry'}`}
              </button>
            </>
          }
        >
          {error && <div className="form-error">{error}</div>}

          <label className="field">
            <span>Amount (CAD)</span>
            <input
              autoFocus
              inputMode="decimal"
              placeholder="0.00"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>

          <div className="row2">
            <label className="field">
              <span>Debit (to)</span>
              <select value={draft.debitId ?? ''} onChange={(e) => setDraft({ ...draft, debitId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Select —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Credit (from)</span>
              <select value={draft.creditId ?? ''} onChange={(e) => setDraft({ ...draft, creditId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Select —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </div>
          {draft.debitId != null && draft.debitId === draft.creditId && (
            <div className="form-error">Debit and credit accounts must differ.</div>
          )}

          <div className="row2">
            <label className="field">
              <span>Date</span>
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </label>
            <label className="field">
              <span>Payee (optional)</span>
              <input value={draft.payee} onChange={(e) => setDraft({ ...draft, payee: e.target.value })} />
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
        </Modal>
      )}
    </>
  );
}
