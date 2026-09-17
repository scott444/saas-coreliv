import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { pool, query, transaction } from './pool.js'

/**
 * Finds `db/migrations` by walking up from this file.
 *
 * Resolving it relative to the module would need two different paths - the
 * source tree runs from server/src/db, the build from dist/server/src/db - so
 * walk up until the directory appears instead.
 */
export function migrationsDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, 'db', 'migrations')
    if (existsSync(candidate)) return candidate
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not locate db/migrations from ' + fileURLToPath(import.meta.url))
}

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

/**
 * Drops and recreates the public schema.
 *
 * `db:reset` is a development convenience, so it refuses to run against
 * anything that is not obviously a local database.
 */
async function reset(): Promise<void> {
  const url = process.env.DATABASE_URL ?? ''
  const isLocal = /@(localhost|127\.0\.0\.1|db|postgres)[:/]/.test(url)
  if (!isLocal && process.env.ALLOW_REMOTE_RESET !== 'true') {
    throw new Error(
      'Refusing to reset a non-local database. Set ALLOW_REMOTE_RESET=true if you really mean it.',
    )
  }
  console.log('Dropping schema public')
  await query('DROP SCHEMA public CASCADE')
  await query('CREATE SCHEMA public')
}

export async function migrate(): Promise<string[]> {
  await ensureMigrationsTable()

  const dir = migrationsDir()
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const applied = new Set(
    (await query<{ filename: string }>('SELECT filename FROM schema_migrations')).map(
      (row) => row.filename,
    ),
  )

  const ran: string[] = []
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(join(dir, file), 'utf8')
    // Each migration is one transaction: a failure half way through leaves
    // nothing behind, so re-running after a fix is always safe.
    await transaction(async (client) => {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
    })
    console.log('applied', file)
    ran.push(file)
  }
  return ran
}
// pathToFileURL rather than string-building a file:// URL: it is the only
// form that matches import.meta.url for a Windows drive path.
const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  try {
    if (process.argv.includes('--reset')) await reset()
    const ran = await migrate()
    console.log(ran.length === 0 ? 'Database already up to date' : `Applied ${ran.length} migration(s)`)
    await pool.end()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    await pool.end().catch(() => {})
    process.exit(1)
  }
}
