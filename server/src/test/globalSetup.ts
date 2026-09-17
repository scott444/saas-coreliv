import { canReachDatabase, ensureTestDatabase, testDatabaseUrl } from './database.js'

/**
 * Creates and migrates the test database once for the whole run.
 *
 * Migrating per file would be wasted work, and two files racing the same
 * migration would deadlock on the DDL locks.
 */
export async function setup(): Promise<void> {
  if (!(await canReachDatabase())) {
    console.warn(
      '\n  Postgres is not reachable - API integration tests will be skipped.' +
        '\n  Start it with: docker compose up -d db\n',
    )
    return
  }

  await ensureTestDatabase()

  process.env.DATABASE_URL = testDatabaseUrl()
  process.env.MIGRATE_ON_BOOT = 'false'

  // Imported after DATABASE_URL is set: pool.ts reads it at module load.
  const { migrate } = await import('../db/migrate.js')
  const { pool } = await import('../db/pool.js')
  await migrate()
  await pool.end()
}
