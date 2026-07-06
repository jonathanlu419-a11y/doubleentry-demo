import { useState } from 'react';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import type { Lookup } from '../../api/types';

/**
 * Generic CRUD list for name-only entities (Categories, Income Sources). Inline add/edit
 * row — no modal needed for a single field. Hooks are passed in so the same component
 * serves both entities.
 */
export default function LookupTab({
  noun,
  blurb,
  useItems,
  useSave,
  useDelete,
}: {
  noun: string;
  blurb: string;
  useItems: () => UseQueryResult<Lookup[]>;
  useSave: () => UseMutationResult<unknown, Error, { id?: number; name: string }>;
  useDelete: () => UseMutationResult<unknown, Error, number>;
}) {
  const { data: items = [], isLoading } = useItems();
  const save = useSave();
  const del = useDelete();
  const [editing, setEditing] = useState<{ id?: number; name: string } | null>(null);

  async function submit() {
    if (!editing || !editing.name.trim()) return;
    await save.mutateAsync({ id: editing.id, name: editing.name.trim() });
    setEditing(null);
  }

  async function remove(item: Lookup) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    await del.mutateAsync(item.id);
  }

  return (
    <div>
      <div className="tab-head">
        <p className="muted">{blurb}</p>
        {!editing && (
          <button className="btn primary" onClick={() => setEditing({ name: '' })}>
            <Plus size={15} /> Add {noun}
          </button>
        )}
      </div>

      {editing && !editing.id && (
        <div className="inline-add">
          <input
            autoFocus
            placeholder={`New ${noun} name`}
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="icon-btn ok" onClick={submit} aria-label="Save"><Check size={16} /></button>
          <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Cancel"><X size={16} /></button>
        </div>
      )}

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead><tr><th>Name</th><th className="right">Actions</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  {editing?.id === item.id ? (
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && submit()}
                    />
                  ) : (
                    item.name
                  )}
                </td>
                <td className="right">
                  {editing?.id === item.id ? (
                    <>
                      <button className="icon-btn ok" onClick={submit} aria-label="Save"><Check size={15} /></button>
                      <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Cancel"><X size={15} /></button>
                    </>
                  ) : (
                    <>
                      <button className="icon-btn" onClick={() => setEditing({ id: item.id, name: item.name })} aria-label="Edit"><Pencil size={15} /></button>
                      <button className="icon-btn danger" onClick={() => remove(item)} aria-label="Delete"><Trash2 size={15} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={2} className="muted center">No {noun} entries yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
