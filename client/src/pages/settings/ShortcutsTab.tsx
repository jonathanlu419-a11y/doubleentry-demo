import { useState } from 'react';
import { Pencil, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import Modal from '../../components/Modal';
import {
  useShortcuts, useSaveShortcut, useDeleteShortcut, useReorderShortcuts,
  useAccounts, useCategories, useIncomeSources, type ShortcutInput,
} from '../../api/hooks';
import { SHORTCUT_KINDS, SHORTCUT_KIND_LABELS, type Shortcut, type ShortcutKind } from '../../api/types';

type Draft = {
  id?: number;
  label: string;
  kind: ShortcutKind;
  icon: string;
  default_account_id: number | null;
  default_counter_account_id: number | null;
  default_category_id: number | null;
  default_income_source_id: number | null;
};

const emptyDraft: Draft = {
  label: '', kind: 'expense', icon: '',
  default_account_id: null, default_counter_account_id: null,
  default_category_id: null, default_income_source_id: null,
};

/** A <select> over ids with a "None" option. */
function IdSelect({ value, onChange, options }: {
  value: number | null;
  onChange: (v: number | null) => void;
  options: { id: number; name: string }[];
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">— None —</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

export default function ShortcutsTab() {
  const { data: shortcuts = [], isLoading } = useShortcuts();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: incomeSources = [] } = useIncomeSources();
  const save = useSaveShortcut();
  const del = useDeleteShortcut();
  const reorder = useReorderShortcuts();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acctName = (id: number | null) => accounts.find((a) => a.id === id)?.name ?? '—';

  function openEdit(s: Shortcut) {
    setError(null);
    setDraft({
      id: s.id, label: s.label, kind: s.kind, icon: s.icon ?? '',
      default_account_id: s.default_account_id, default_counter_account_id: s.default_counter_account_id,
      default_category_id: s.default_category_id, default_income_source_id: s.default_income_source_id,
    });
  }

  async function submit() {
    if (!draft) return;
    if (!draft.label.trim()) return setError('Label is required.');
    const data: ShortcutInput = {
      label: draft.label.trim(),
      kind: draft.kind,
      icon: draft.icon.trim() || null,
      default_account_id: draft.default_account_id,
      default_counter_account_id: draft.default_counter_account_id,
      default_category_id: draft.default_category_id,
      default_income_source_id: draft.default_income_source_id,
    };
    try {
      await save.mutateAsync({ id: draft.id, data });
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...shortcuts];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    await reorder.mutateAsync(next.map((s) => s.id));
  }

  async function remove(s: Shortcut) {
    if (!window.confirm(`Delete shortcut "${s.label}"?`)) return;
    await del.mutateAsync(s.id);
  }

  return (
    <div>
      <div className="tab-head">
        <p className="muted">Quick Add buttons. Each shortcut pre-fills a balanced entry between two accounts.</p>
        <button className="btn primary" onClick={() => { setError(null); setDraft({ ...emptyDraft }); }}>
          <Plus size={15} /> Add shortcut
        </button>
      </div>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Label</th><th>Kind</th><th>Account → Counter</th><th className="right">Actions</th></tr>
          </thead>
          <tbody>
            {shortcuts.map((s, i) => (
              <tr key={s.id}>
                <td className="reorder">
                  <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ChevronUp size={15} /></button>
                  <button className="icon-btn" disabled={i === shortcuts.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ChevronDown size={15} /></button>
                </td>
                <td>{s.label}</td>
                <td><span className="badge">{SHORTCUT_KIND_LABELS[s.kind]}</span></td>
                <td className="muted">{acctName(s.default_account_id)} → {acctName(s.default_counter_account_id)}</td>
                <td className="right">
                  <button className="icon-btn" onClick={() => openEdit(s)} aria-label="Edit"><Pencil size={15} /></button>
                  <button className="icon-btn danger" onClick={() => remove(s)} aria-label="Delete"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {shortcuts.length === 0 && <tr><td colSpan={5} className="muted center">No shortcuts yet.</td></tr>}
          </tbody>
        </table>
      )}

      {draft && (
        <Modal
          title={draft.id ? 'Edit shortcut' : 'Add shortcut'}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn primary" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          {error && <div className="form-error">{error}</div>}
          <label className="field">
            <span>Label</span>
            <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} autoFocus placeholder="Groceries" />
          </label>
          <label className="field">
            <span>Kind</span>
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ShortcutKind })}>
              {SHORTCUT_KINDS.map((k) => <option key={k} value={k}>{SHORTCUT_KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Debit account (money goes to)</span>
            <IdSelect value={draft.default_account_id} onChange={(v) => setDraft({ ...draft, default_account_id: v })} options={accounts} />
          </label>
          <label className="field">
            <span>Credit account (money comes from)</span>
            <IdSelect value={draft.default_counter_account_id} onChange={(v) => setDraft({ ...draft, default_counter_account_id: v })} options={accounts} />
          </label>
          <label className="field">
            <span>Default category (optional)</span>
            <IdSelect value={draft.default_category_id} onChange={(v) => setDraft({ ...draft, default_category_id: v })} options={categories} />
          </label>
          <label className="field">
            <span>Default income source (optional)</span>
            <IdSelect value={draft.default_income_source_id} onChange={(v) => setDraft({ ...draft, default_income_source_id: v })} options={incomeSources} />
          </label>
          <label className="field">
            <span>Icon name (optional, lucide)</span>
            <input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="shopping-cart" />
          </label>
        </Modal>
      )}
    </div>
  );
}
