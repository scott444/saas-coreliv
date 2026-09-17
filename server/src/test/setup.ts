import { afterAll } from 'vitest'
import { testDatabaseUrl } from './database.js'

/**
 * Runs before any test module is imported, which matters: `env.ts` reads
 * DATABASE_URL at module load and `pool.ts` builds its pool from it, so
 * pointing them at the test database has to happen first.
 */
process.env.DATABASE_URL = testDatabaseUrl()
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'
// The suite manages migrations itself, once, in globalSetup.
process.env.MIGRATE_ON_BOOT = 'false'

/**
 * One pool teardown per test file, registered here rather than in each suite.
 *
 * The pool is a module singleton, so a file with two `describe` blocks that
 * each closed it would have the first block pull the connection out from
 * under the second. A setup file's afterAll runs once per file, whatever the
 * file contains.
 *
 * Imported dynamically so pool.ts is only loaded after DATABASE_URL is set.
 */
afterAll(async () => {
  const { pool } = await import('../db/pool.js')
  await pool.end().catch(() => {})
})
