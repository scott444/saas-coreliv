import pg from 'pg'
import { env } from '../env.js'

const { Pool, types } = pg

// ---------------------------------------------------------------------------
// Type parsers
//
// Three of node-postgres' defaults are wrong for this API's wire format, and
// all three are easier to fix once here than at every call site.
// ---------------------------------------------------------------------------

// numeric/decimal arrives as a string to preserve arbitrary precision. Costs
// here are money in the hundreds, well inside a double, and the domain types
// say `number`.
types.setTypeParser(1700, (value) => (value === null ? null : Number.parseFloat(value)))

// bigint, same reasoning - these are byte sizes and counts.
types.setTypeParser(20, (value) => (value === null ? null : Number.parseInt(value, 10)))

// `date` is a calendar date, not an instant. The default parser turns it into
// a local-midnight Date, which then serializes to the *previous* day's
// timestamp for anyone behind UTC. Keep the "YYYY-MM-DD" text exactly as
// Postgres produced it.
types.setTypeParser(1082, (value) => value)

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

export type Queryable = Pick<pg.PoolClient, 'query'>

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
  client: Queryable = pool,
): Promise<T[]> {
  const result = await client.query<T>(text, params as unknown[])
  return result.rows
}

/** The single row a query is expected to return, or null. */
export async function queryOne<T extends pg.QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
  client: Queryable = pool,
): Promise<T | null> {
  const rows = await query<T>(text, params, client)
  return rows[0] ?? null
}

/** Runs `fn` inside a transaction, rolling back on any throw. */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** Postgres error codes this API translates rather than letting 500. */
export const PG_UNIQUE_VIOLATION = '23505'
export const PG_FOREIGN_KEY_VIOLATION = '23503'
export const PG_CHECK_VIOLATION = '23514'

export function pgErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    return typeof code === 'string' ? code : null
  }
  return null
}
