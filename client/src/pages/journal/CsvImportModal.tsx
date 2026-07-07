/**
 * CSV import wizard: Upload → Map columns → Review (4 tabs: Ready / Needs review /
 * Duplicates / Errors) → Done. Each imported row posts a real balanced 2-line entry
 * against the chosen bank account via POST /api/entries/import (per-row isolation).
 */
import { useMemo, useRef, useState } from 'react';
import { Upload, ChevronLeft, Check } from 'lucide-react';
import Modal from '../../components/Modal';
import { useAccounts, useImportEntries, type ImportResult } from '../../api/hooks';
import {
  parseCsv, autoSuggestMapping, buildImportRows, rowTab, toEntryInput,
  type ParsedCsv, type ColumnMapping, type ImportRow, type RowTab,
} from '../../lib/csv';
import { formatCents } from '../../lib/money';

type Step = 'upload' | 'map' | 'review' | 'done';

const TAB_LABELS: Record<RowTab, string> = {
  ready: 'Ready',
  review: 'Needs review',
  duplicate: 'Duplicates',
  error: 'Errors',
};
const TAB_ORDER: RowTab[] = ['ready', 'review', 'duplicate', 'error'];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  date: 'Date',
  description: 'Description',
  amount: 'Amount (signed: + in, − out)',
  counter: 'Counter account / category',
  payee: 'Payee (optional)',
};

export default function CsvImportModal({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const importMut = useImportEntries();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [bankId, setBankId] = useState<number | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: null, description: null, amount: null, counter: null, payee: null });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [tab, setTab] = useState<RowTab>('ready');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Counter-account candidates exclude the bank account itself.
  const counterAccounts = useMemo(() => accounts.filter((a) => a.id !== bankId), [accounts, bankId]);

  async function onFile(file: File) {
    setError(null);
    try {
      const p = await parseCsv(file);
      if (p.rows.length === 0) return setError('No data rows found in that file.');
      setFileName(file.name);
      setParsed(p);
      setMapping(autoSuggestMapping(p.headers));
      setStep('map');
    } catch (e) {
      setError(`Could not parse file: ${(e as Error).message}`);
    }
  }

  function toReview() {
    if (!parsed || bankId == null) return;
    if (!mapping.date || !mapping.amount || !mapping.counter) {
      return setError('Date, Amount, and Counter account columns are required.');
    }
    setError(null);
    setRows(buildImportRows(parsed, mapping, counterAccounts));
    setTab('ready');
    setStep('review');
  }

  const byTab = useMemo(() => {
    const map: Record<RowTab, ImportRow[]> = { ready: [], review: [], duplicate: [], error: [] };
    for (const r of rows) map[rowTab(r)].push(r);
    return map;
  }, [rows]);

  const importable = useMemo(
    () => rows.filter((r) => r.action === 'import' && r.errors.length === 0 && r.resolvedId !== null),
    [rows],
  );

  function patchRow(index: number, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r) => (r.index === index ? { ...r, ...patch } : r)));
  }

  function bulk(tabKey: RowTab, action: 'import' | 'skip') {
    setRows((prev) => prev.map((r) => (rowTab(r) === tabKey && r.errors.length === 0 ? { ...r, action } : r)));
  }

  async function runImport() {
    if (bankId == null || importable.length === 0) return;
    try {
      const payload = importable.map((r) => toEntryInput(r, bankId));
      const res = await importMut.mutateAsync(payload);
      setResult(res);
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ── Steps ─────────────────────────────────────────────────────────────────
  return (
    <Modal title={`Import CSV${fileName ? ` — ${fileName}` : ''}`} onClose={onClose} wide
      footer={
        step === 'map' ? (
          <>
            <button className="btn ghost" onClick={() => setStep('upload')}><ChevronLeft size={15} /> Back</button>
            <button className="btn primary" onClick={toReview} disabled={bankId == null}>Review rows</button>
          </>
        ) : step === 'review' ? (
          <>
            <button className="btn ghost" onClick={() => setStep('map')}><ChevronLeft size={15} /> Back</button>
            <button className="btn primary" onClick={runImport} disabled={importable.length === 0 || importMut.isPending}>
              {importMut.isPending ? 'Importing…' : `Import ${importable.length} ${importable.length === 1 ? 'entry' : 'entries'}`}
            </button>
          </>
        ) : step === 'done' ? (
          <button className="btn primary" onClick={onClose}>Close</button>
        ) : undefined
      }
    >
      {error && <div className="form-error">{error}</div>}

      {step === 'upload' && (
        <div className="upload-zone" onClick={() => fileRef.current?.click()}>
          <Upload size={28} />
          <p>Click to choose a CSV file (bank or brokerage export).</p>
          <p className="muted">Needs columns for date, amount (signed), and a counter account / category.</p>
          <input
            ref={fileRef} type="file" accept=".csv,text/csv" hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>
      )}

      {step === 'map' && parsed && (
        <>
          <label className="field">
            <span>Bank account being imported (the fixed side of every entry)</span>
            <select value={bankId ?? ''} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div className="map-grid">
            {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => (
              <label className="field" key={field}>
                <span>{FIELD_LABELS[field]}</span>
                <select
                  value={mapping[field] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || null })}
                >
                  <option value="">— Not mapped —</option>
                  {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="muted">{parsed.rows.length} data rows detected. Positive amounts are treated as money into the bank account, negative as money out.</p>
        </>
      )}

      {step === 'review' && (
        <>
          <div className="tabs">
            {TAB_ORDER.map((t) => (
              <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
                {TAB_LABELS[t]} ({byTab[t].length})
              </button>
            ))}
          </div>

          {tab !== 'error' && byTab[tab].length > 0 && (
            <div className="bulk-row">
              <button className="btn ghost sm" onClick={() => bulk(tab, 'import')}>Import all in tab</button>
              <button className="btn ghost sm" onClick={() => bulk(tab, 'skip')}>Skip all in tab</button>
            </div>
          )}

          <div className="review-scroll">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Date</th><th>Description</th><th className="right">Amount</th>
                  <th>Counter account</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {byTab[tab].map((r) => (
                  <tr key={r.index} className={r.action === 'skip' ? 'row-skipped' : ''}>
                    <td className="mono nowrap">{r.dateISO ?? <span className="neg-text">{'invalid'}</span>}</td>
                    <td>
                      {r.description || <span className="muted">—</span>}
                      {tab === 'error' && <div className="sub neg-text">{r.errors.join('; ')}</div>}
                      {tab === 'duplicate' && <div className="sub muted">Same date/amount/account as row {(r.duplicateOf ?? 0) + 1}</div>}
                    </td>
                    <td className="right mono">
                      {r.amountCents !== null ? formatCents(r.amountCents) : '—'}
                    </td>
                    <td>
                      {tab === 'error' ? (
                        <span className="muted">{r.counterText || '—'}</span>
                      ) : (
                        <select
                          value={r.resolvedId ?? ''}
                          onChange={(e) => {
                            const id = e.target.value ? Number(e.target.value) : null;
                            patchRow(r.index, { resolvedId: id, action: id !== null ? 'import' : 'skip' });
                          }}
                        >
                          <option value="">— Pick account — ({r.counterText || 'blank'})</option>
                          {counterAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td>
                      {r.errors.length > 0 ? (
                        <span className="badge">Skip</span>
                      ) : (
                        <select
                          value={r.action}
                          onChange={(e) => patchRow(r.index, { action: e.target.value as 'import' | 'skip' })}
                          disabled={r.resolvedId === null}
                        >
                          <option value="import">Import</option>
                          <option value="skip">Skip</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
                {byTab[tab].length === 0 && <tr><td colSpan={5} className="muted center">Nothing in this tab.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <div className="done-summary">
          <Check size={30} className="ok-text" />
          <h3>{result.imported} {result.imported === 1 ? 'entry' : 'entries'} imported</h3>
          {result.errors.length > 0 && (
            <>
              <p className="neg-text">{result.errors.length} row(s) failed server-side validation:</p>
              <ul className="muted">
                {result.errors.map((e) => <li key={e.index}>Row {e.index + 1}: {e.error}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
