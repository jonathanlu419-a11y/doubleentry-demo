import { query, queryOne } from '../db/pool';

/**
 * categories and income_sources are structurally identical (id, session_id, name), so a
 * single factory produces both repos. Keeps the two Settings lists DRY.
 */
export interface LookupRow {
  id: number;
  name: string;
}

function makeLookupRepo(table: 'categories' | 'income_sources') {
  return {
    list(sessionId: string): Promise<LookupRow[]> {
      return query<LookupRow>(`SELECT id, name FROM ${table} WHERE session_id = $1 ORDER BY name`, [sessionId]);
    },
    getById(sessionId: string, id: number): Promise<LookupRow | undefined> {
      return queryOne<LookupRow>(`SELECT id, name FROM ${table} WHERE session_id = $1 AND id = $2`, [sessionId, id]);
    },
    create(sessionId: string, name: string): Promise<LookupRow | undefined> {
      return queryOne<LookupRow>(
        `INSERT INTO ${table} (session_id, name) VALUES ($1, $2) RETURNING id, name`,
        [sessionId, name],
      );
    },
    update(sessionId: string, id: number, name: string): Promise<LookupRow | undefined> {
      return queryOne<LookupRow>(
        `UPDATE ${table} SET name = $3 WHERE session_id = $1 AND id = $2 RETURNING id, name`,
        [sessionId, id, name],
      );
    },
    async remove(sessionId: string, id: number): Promise<void> {
      // FKs on journal_entries / shortcuts are ON DELETE SET NULL, so delete is always safe.
      await query(`DELETE FROM ${table} WHERE session_id = $1 AND id = $2`, [sessionId, id]);
    },
  };
}

export const categoryRepo = makeLookupRepo('categories');
export const incomeSourceRepo = makeLookupRepo('income_sources');
