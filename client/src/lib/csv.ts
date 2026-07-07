/**
 * CSV import core — pure logic, no React. Pipeline:
 *   parseCsv → buildImportRows (normalize + fuzzy-resolve + validate) → detectDuplicates
 * Each CSV row becomes a 2-line journal entry against a user-chosen bank account:
 *   amount > 0 → money IN  → Dr bank / Cr counter-account
 *   amount < 0 → money OUT → Dr counter-account / Cr bank
 */
import Papa from 'papaparse';
import type { Account } from '../api/types';
import type { EntryInput } from '../api/hooks';

// ── Parsing ───────────────────────────────────────────────────────────────────

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (res) => resolve({ headers: res.meta.fields ?? [], rows: res.data }),
      error: (err) => reject(err),
    });
  });
}

// ── Field auto-suggestion (column header → app field) ─────────────────────────

export interface ColumnMapping {
  date: string | null;
  description: string | null;
  amount: string | null;
  counter: string | null; // the text naming the other account (category/merchant/account col)
  payee: string | null;
}

const FIELD_KEYWORDS: Record<keyof ColumnMapping, string[]> = {
  date: ['date', 'posted', 'transaction date'],
  description: ['description', 'memo', 'narrative', 'details', 'transaction'],
  amount: ['amount', 'value', 'debit/credit', 'cad$', 'total'],
  counter: ['account', 'category', 'merchant', 'type'],
  payee: ['payee', 'name', 'vendor', 'counterparty'],
};

export function autoSuggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { date: null, description: null, amount: null, counter: null, payee: null };
  const used = new Set<string>();
  for (const field of Object.keys(FIELD_KEYWORDS) as (keyof ColumnMapping)[]) {
    for (const kw of FIELD_KEYWORDS[field]) {
      const hit = headers.find((h) => !used.has(h) && h.toLowerCase().includes(kw));
      if (hit) {
        mapping[field] = hit;
        used.add(hit);
        break;
      }
    }
  }
  return mapping;
}

// ── Normalizers ───────────────────────────────────────────────────────────────

/** Accepts YYYY-MM-DD, YYYY/M/D, M/D/YYYY (US) and returns YYYY-MM-DD, or null. */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Real-calendar check (e.g. rejects Feb 30).
  const dt = new Date(`${iso}T00:00:00`);
  return dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d ? iso : null;
}

/** "1,234.50", "$42", "(85.00)" → signed integer cents, or null. Parentheses = negative. */
export function parseAmountCents(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

// ── Fuzzy account resolution ──────────────────────────────────────────────────

export type Confidence = 'exact' | 'fuzzy' | 'none';

export interface Resolution {
  account: Account | null;
  confidence: Confidence;
}

/** Standard Levenshtein edit distance (DP, O(a·b)). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...new Array<number>(n)];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Resolve free text to an account: exact (code or name, case-insensitive) → substring
 * containment → best Levenshtein with normalized score ≤ 0.4. Mirrors the tiered
 * approach of the account search elsewhere in the app.
 */
export function resolveAccount(text: string, accounts: Account[]): Resolution {
  const q = text.trim().toLowerCase();
  if (!q) return { account: null, confidence: 'none' };

  const exact = accounts.find((a) => a.code?.toLowerCase() === q || a.name.toLowerCase() === q);
  if (exact) return { account: exact, confidence: 'exact' };

  const contains = accounts.find((a) => {
    const n = a.name.toLowerCase();
    return n.includes(q) || q.includes(n);
  });
  if (contains) return { account: contains, confidence: 'fuzzy' };

  let best: Account | null = null;
  let bestScore = Infinity;
  for (const a of accounts) {
    const n = a.name.toLowerCase();
    const score = levenshtein(q, n) / Math.max(q.length, n.length);
    if (score < bestScore) {
      best = a;
      bestScore = score;
    }
  }
  if (best && bestScore <= 0.4) return { account: best, confidence: 'fuzzy' };
  return { account: null, confidence: 'none' };
}

// ── Row model ─────────────────────────────────────────────────────────────────

export type RowTab = 'ready' | 'review' | 'duplicate' | 'error';

export interface ImportRow {
  index: number;
  raw: Record<string, string>;
  dateISO: string | null;
  description: string;
  payee: string | null;
  counterText: string;
  amountCents: number | null; // signed: + money in, − money out
  resolvedId: number | null; // counter account (user-overridable)
  confidence: Confidence;
  errors: string[];
  duplicateOf: number | null; // index of the first identical row in this file
  action: 'import' | 'skip';
}

export function buildImportRows(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  accounts: Account[],
): ImportRow[] {
  const rows: ImportRow[] = parsed.rows.map((raw, index) => {
    const get = (col: string | null) => (col ? (raw[col] ?? '').trim() : '');
    const errors: string[] = [];

    const dateISO = normalizeDate(get(mapping.date));
    if (!dateISO) errors.push('Unrecognized or missing date');

    const amountCents = parseAmountCents(get(mapping.amount));
    if (amountCents === null) errors.push('Unrecognized or missing amount');
    else if (amountCents === 0) errors.push('Amount is zero');

    const counterText = get(mapping.counter);
    const { account, confidence } = resolveAccount(counterText, accounts);

    return {
      index,
      raw,
      dateISO,
      description: get(mapping.description),
      payee: get(mapping.payee) || null,
      counterText,
      amountCents,
      resolvedId: account?.id ?? null,
      confidence,
      errors,
      duplicateOf: null,
      action: 'import' as const,
    };
  });

  detectDuplicates(rows);

  // Default actions: errors and duplicates start skipped; unresolved rows can't import
  // until the user picks an account (the UI enforces that at import time too).
  for (const r of rows) {
    if (r.errors.length > 0 || r.duplicateOf !== null) r.action = 'skip';
    else if (r.confidence === 'none') r.action = 'skip';
  }
  return rows;
}

/** In-file duplicate detection: same date + amount + counter text ⇒ later rows flagged. */
function detectDuplicates(rows: ImportRow[]): void {
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.errors.length > 0) continue;
    const key = `${r.dateISO}|${r.amountCents}|${r.counterText.toLowerCase()}`;
    const first = seen.get(key);
    if (first !== undefined) r.duplicateOf = first;
    else seen.set(key, r.index);
  }
}

/** Which review tab a row belongs to. */
export function rowTab(r: ImportRow): RowTab {
  if (r.errors.length > 0) return 'error';
  if (r.duplicateOf !== null) return 'duplicate';
  if (r.confidence === 'exact' && r.resolvedId !== null) return 'ready';
  return 'review';
}

/** Convert an importable row to the API payload. Caller guarantees resolvedId + validity. */
export function toEntryInput(r: ImportRow, bankAccountId: number): EntryInput {
  const cents = Math.abs(r.amountCents as number);
  const moneyIn = (r.amountCents as number) > 0;
  const counterId = r.resolvedId as number;
  return {
    entry_date: r.dateISO as string,
    description: r.description || r.counterText || null,
    payee: r.payee,
    category_id: null,
    income_source_id: null,
    lines: moneyIn
      ? [
          { account_id: bankAccountId, side: 'debit', amount_cents: cents },
          { account_id: counterId, side: 'credit', amount_cents: cents },
        ]
      : [
          { account_id: counterId, side: 'debit', amount_cents: cents },
          { account_id: bankAccountId, side: 'credit', amount_cents: cents },
        ],
  };
}
