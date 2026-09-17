import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../env.js'
import { query, queryOne, type Queryable } from '../db/pool.js'

export interface SessionUser {
  id: string
  name: string
  email: string
}

export interface IssuedSession {
  token: string
  expiresAt: string
}

/**
 * Tokens are opaque random bytes, not JWTs.
 *
 * Nothing about this app needs stateless verification, and a table lookup buys
 * revocation for free - signing out, removing a member or a leaked token all
 * take effect immediately. Only the SHA-256 of the token is stored, so a dump
 * of `sessions` does not hand anyone a live login.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function issueSession(userId: string, client?: Queryable): Promise<IssuedSession> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 86_400_000)
  await query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashToken(token), expiresAt],
    client,
  )
  return { token, expiresAt: expiresAt.toISOString() }
}

export async function resolveSession(token: string): Promise<SessionUser | null> {
  if (!token) return null
  const row = await queryOne<SessionUser & { sessionId: string }>(
    `SELECT s.id AS "sessionId", u.id, u.name, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  )
  if (!row) return null

  // Sliding activity stamp, not a sliding expiry: it answers "is this session
  // still in use" for cleanup without silently extending a token's life.
  void query('UPDATE sessions SET last_used_at = now() WHERE id = $1', [row.sessionId]).catch(
    () => {},
  )

  return { id: row.id, name: row.name, email: row.email }
}

export async function revokeSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
}

/** Removes expired rows. Called on boot; cheap enough not to need a scheduler. */
export async function purgeExpiredSessions(): Promise<number> {
  const rows = await query<{ id: string }>(
    'DELETE FROM sessions WHERE expires_at < now() RETURNING id',
  )
  return rows.length
}

/**
 * Constant-time compare for the rare places a raw secret is checked directly.
 * Exported so route code never reaches for `===` on a token.
 */
export function secretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}
