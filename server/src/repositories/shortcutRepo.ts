import { query, queryOne, withTransaction } from '../db/pool';

export type ShortcutKind = 'expense' | 'income' | 'transfer' | 'card_payment';

export interface ShortcutRow {
  id: number;
  label: string;
  icon: string | null;
  kind: ShortcutKind;
  default_account_id: number | null;
  default_counter_account_id: number | null;
  default_category_id: number | null;
  default_income_source_id: number | null;
  sort_order: number;
}

export interface ShortcutInput {
  label: string;
  icon?: string | null;
  kind: ShortcutKind;
  default_account_id?: number | null;
  default_counter_account_id?: number | null;
  default_category_id?: number | null;
  default_income_source_id?: number | null;
}

export const shortcutRepo = {
  list(sessionId: string): Promise<ShortcutRow[]> {
    return query<ShortcutRow>(
      'SELECT * FROM shortcuts WHERE session_id = $1 ORDER BY sort_order, id',
      [sessionId],
    );
  },

  async create(sessionId: string, dto: ShortcutInput): Promise<ShortcutRow | undefined> {
    // New shortcut goes to the end of the list.
    const maxRow = await queryOne<{ max: number | null }>(
      'SELECT MAX(sort_order) AS max FROM shortcuts WHERE session_id = $1',
      [sessionId],
    );
    const sortOrder = (maxRow?.max ?? -1) + 1;
    return queryOne<ShortcutRow>(
      `INSERT INTO shortcuts
         (session_id, label, icon, kind, default_account_id, default_counter_account_id,
          default_category_id, default_income_source_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        sessionId, dto.label, dto.icon ?? null, dto.kind,
        dto.default_account_id ?? null, dto.default_counter_account_id ?? null,
        dto.default_category_id ?? null, dto.default_income_source_id ?? null, sortOrder,
      ],
    );
  },

  update(sessionId: string, id: number, dto: ShortcutInput): Promise<ShortcutRow | undefined> {
    return queryOne<ShortcutRow>(
      `UPDATE shortcuts SET
         label = $3, icon = $4, kind = $5, default_account_id = $6, default_counter_account_id = $7,
         default_category_id = $8, default_income_source_id = $9
       WHERE session_id = $1 AND id = $2 RETURNING *`,
      [
        sessionId, id, dto.label, dto.icon ?? null, dto.kind,
        dto.default_account_id ?? null, dto.default_counter_account_id ?? null,
        dto.default_category_id ?? null, dto.default_income_source_id ?? null,
      ],
    );
  },

  async remove(sessionId: string, id: number): Promise<void> {
    await query('DELETE FROM shortcuts WHERE session_id = $1 AND id = $2', [sessionId, id]);
  },

  /** Persist a new ordering: sort_order = array index. */
  async reorder(sessionId: string, ids: number[]): Promise<void> {
    await withTransaction(async (client) => {
      for (let i = 0; i < ids.length; i++) {
        await client.query('UPDATE shortcuts SET sort_order = $1 WHERE session_id = $2 AND id = $3', [
          i, sessionId, ids[i],
        ]);
      }
    });
  },
};
