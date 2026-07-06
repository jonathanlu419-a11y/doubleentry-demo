import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import Modal from '../../components/Modal';
import { useAccounts, useSaveAccount, useDeleteAccount, type AccountInput } from '../../api/hooks';
import { ACCOUNT_NATURES, type Account, type AccountNature } from '../../api/types';
import { formatCents, dollarsToCents, centsToInput } from '../../lib/money';

type Draft = { id?: number; code: string; name: string; nature: AccountNature; balance: string };

const emptyDraft: Draft = { code: '', name: '', nature: 'Asset', balance: '0.00' };

export default function AccountsTab() {
  const { data: accounts = [], isLoading } = useAccounts();
  const save = useSaveAccount();
  const del = useDeleteAccount();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openEdit(a: Account) {
    setError(null);
    setDraft({ id: a.id, code: a.code ?? '', name: a.name, nature: a.nature, balance: centsToInput(a.starting_balance_cents) });
  }

  async function submit() {
    if (!draft) return;
    const cents = dollarsToCents(draft.balance);
    if (!draft.name.trim()) return setError('Name is required.');
    if (cents === null) return setError('Starting balance must be a number.');
    const data: AccountInput = {
      code: draft.code.trim() || null,
      name: draft.name.trim(),
      nature: draft.nature,
      starting_balance_cents: cents,
    };
    try {
      await save.mutateAsync({ id: draft.id, data });
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(a: Account) {
    if (!window.confirm(`Delete account "${a.name}"?`)) return;
    try {
      await del.mutateAsync(a.id);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  return (
    <div>
      <div className="tab-head">
        <p className="muted">Your chart of accounts. Each account has a nature that drives how its balance is signed.</p>
        <button className="btn primary" onClick={() => { setError(null); setDraft({ ...emptyDraft }); }}>
          <Plus size={15} /> Add account
        </button>
      </div>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Nature</th>
              <th className="right">Starting balance</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="mono muted">{a.code ?? '—'}</td>
                <td>{a.name}</td>
                <td><span className={`badge nature-${a.nature.toLowerCase()}`}>{a.nature}</span></td>
                <td className="right mono">{formatCents(a.starting_balance_cents)}</td>
                <td className="right">
                  <button className="icon-btn" onClick={() => openEdit(a)} aria-label="Edit"><Pencil size={15} /></button>
                  <button className="icon-btn danger" onClick={() => remove(a)} aria-label="Delete"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan={5} className="muted center">No accounts yet.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {draft && (
        <Modal
          title={draft.id ? 'Edit account' : 'Add account'}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn primary" onClick={submit} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          {error && <div className="form-error">{error}</div>}
          <label className="field">
            <span>Code (optional)</span>
            <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="A100" />
          </label>
          <label className="field">
            <span>Name</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </label>
          <label className="field">
            <span>Nature</span>
            <select value={draft.nature} onChange={(e) => setDraft({ ...draft, nature: e.target.value as AccountNature })}>
              {ACCOUNT_NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Starting balance (CAD)</span>
            <input value={draft.balance} onChange={(e) => setDraft({ ...draft, balance: e.target.value })} inputMode="decimal" />
          </label>
        </Modal>
      )}
    </div>
  );
}
