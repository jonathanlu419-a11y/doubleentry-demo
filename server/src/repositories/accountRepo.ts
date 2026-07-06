import { query, queryOne } from '../db/pool';

export type AccountNature = 'Asset' | 'Liability' | 'Revenue' | 'Expense';

export interface AccountRow {
  id: number;
  code: string | null;
  name: string;
  nature: AccountNature;
  starting_balance_cents: number;
  created_at: string;
}

export interface AccountInput {
  code?: string | null;
  name: string;
  nature: AccountNature;
  starting_balance_cents?: number;
}

export interface AccountBalanceRow extends AccountRow {
  balance_cents: number;
}


export const accountRepo = {
  list(sessionId: string): Promise<AccountRow[]> {
    return query<AccountRow>(
      `SELECT * FROM accounts WHERE session_id = $1
       ORDER BY CASE nature WHEN 'Asset' THEN 0 WHEN 'Liability' THEN 1 WHEN 'Revenue' THEN 2 ELSE 3 END,
                code NULLS LAST, name`,
      [sessionId],
    );
  },

  getById(sessionId: string, id: number): Promise<AccountRow | undefined> {
    return queryOne<AccountRow>('SELECT * FROM accounts WHERE session_id = $1 AND id = $2', [sessionId, id]);
  },

  /**
   * Every account with its running balance from posted lines, nature-aware:
   *   net = Σdebit − Σcredit
   *   debit-normal (Asset/Expense):  balance = starting + net
   *   credit-normal (Liability/Revenue): balance = starting − net
   */
  listWithBalances(sessionId: string): Promise<AccountBalanceRow[]> {
    return query<AccountBalanceRow>(
      `SELECT a.*,
              (a.starting_balance_cents
               + COALESCE(SUM(CASE WHEN l.side = 'debit' THEN l.amount_cents ELSE -l.amount_cents END), 0)
                 * CASE WHEN a.nature IN ('Asset', 'Expense') THEN 1 ELSE -1 END
              )::bigint AS balance_cents
       FROM accounts a
       LEFT JOIN journal_lines l ON l.account_id = a.id AND l.session_id = a.session_id
       WHERE a.session_id = $1
       GROUP BY a.id
       ORDER BY CASE a.nature WHEN 'Asset' THEN 0 WHEN 'Liability' THEN 1 WHEN 'Revenue' THEN 2 ELSE 3 END,
                a.code NULLS LAST, a.name`,
      [sessionId],
    );
  },

  create(sessionId: string, dto: AccountInput): Promise<AccountRow | undefined> {
    return queryOne<AccountRow>(
      `INSERT INTO accounts (session_id, code, name, nature, starting_balance_cents)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [sessionId, dto.code ?? null, dto.name, dto.nature, dto.starting_balance_cents ?? 0],
    );
  },

  update(sessionId: string, id: number, dto: AccountInput): Promise<AccountRow | undefined> {
    return queryOne<AccountRow>(
      `UPDATE accounts SET code = $3, name = $4, nature = $5, starting_balance_cents = $6
       WHERE session_id = $1 AND id = $2 RETURNING *`,
      [sessionId, id, dto.code ?? null, dto.name, dto.nature, dto.starting_balance_cents ?? 0],
    );
  },

  /** True if any journal line references this account (blocks delete — FK is RESTRICT). */
  async isReferenced(sessionId: string, id: number): Promise<boolean> {
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM journal_lines WHERE session_id = $1 AND account_id = $2`,
      [sessionId, id],
    );
    return (row?.n ?? 0) > 0;
  },

  async remove(sessionId: string, id: number): Promise<void> {
    await query('DELETE FROM accounts WHERE session_id = $1 AND id = $2', [sessionId, id]);
  },
};
