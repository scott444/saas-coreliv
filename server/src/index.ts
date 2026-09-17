import { buildApp } from './app.js'
import { env } from './env.js'
import { pool } from './db/pool.js'
import { migrate } from './db/migrate.js'
import { purgeExpiredSessions } from './auth/session.js'

const app = await buildApp()

try {
  // Migrating on boot keeps `docker compose up` a single step. Each migration
  // is one transaction and the ledger is a table, so two API replicas starting
  // together cannot apply the same file twice.
  if (process.env.MIGRATE_ON_BOOT !== 'false') {
    const ran = await migrate()
    if (ran.length > 0) app.log.info({ migrations: ran }, 'applied migrations')
  }

  const purged = await purgeExpiredSessions()
  if (purged > 0) app.log.info({ purged }, 'removed expired sessions')

  await app.listen({ host: env.host, port: env.port })
} catch (error) {
  app.log.error({ err: error }, 'failed to start')
  await pool.end().catch(() => {})
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down')
    void app
      .close()
      .then(() => pool.end())
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  })
}
