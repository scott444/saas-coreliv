import pg from 'pg'

/**
 * Where the integration tests point.
 *
 * A separate database, not a separate schema: the migrations are unqualified,
 * and `db:reset` drops `public`, so sharing a database with development data
 * would eventually destroy it. Derived from DATABASE_URL by suffixing the
 * database name, so anyone who can run the app can run these.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL
  if (explicit) return explicit

  const base = process.env.DATABASE_URL ?? 'postgres://coreliv:coreliv@localhost:5433/coreliv'
  const url = new URL(base)
  const name = url.pathname.replace(/^\//, '') || 'coreliv'

  // Idempotent on purpose. The vitest setup file points DATABASE_URL at the
  // result of this call, so anything that derives it again - the harness, a
  // helper - would otherwise suffix a suffix and look for `..._test_test`.
  url.pathname = name.endsWith('_test') ? `/${name}` : `/${name}_test`
  return url.toString()
}

/** The same server, connected to the maintenance database. */
function maintenanceUrl(url: string): { url: string; database: string } {
  const parsed = new URL(url)
  const database = parsed.pathname.replace(/^\//, '')
  parsed.pathname = '/postgres'
  return { url: parsed.toString(), database }
}

/**
 * True when the test database server is reachable.
 *
 * Used to skip the whole suite rather than fail it: these tests need Postgres,
 * and someone running `npm test` to check a component should not be told the
 * build is broken because they have no database running.
 */
export async function canReachDatabase(): Promise<boolean> {
  const { url } = maintenanceUrl(testDatabaseUrl())
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 })
  try {
    await client.connect()
    await client.end()
    return true
  } catch {
    return false
  }
}

/** Creates the test database if it is not there yet. */
export async function ensureTestDatabase(): Promise<void> {
  const { url, database } = maintenanceUrl(testDatabaseUrl())
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 })
  await client.connect()
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
    if (rows.length === 0) {
      // Not parameterisable - an identifier, not a value - so it is quoted
      // explicitly. `database` comes from our own env, never from a request.
      await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`)
    }
  } finally {
    await client.end()
  }
}
