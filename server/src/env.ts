function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

function int(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be an integer, got ${raw}`)
  return parsed
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  host: process.env.HOST ?? '0.0.0.0',
  port: int('PORT', 3000),
  /** How long a login lasts before the bearer token stops working. */
  sessionTtlDays: int('SESSION_TTL_DAYS', 30),
  /**
   * Allowed browser origins. In dev the Vite proxy makes the API same-origin,
   * so this is only needed when the SPA is served from somewhere else.
   */
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  isProduction: process.env.NODE_ENV === 'production',
}
