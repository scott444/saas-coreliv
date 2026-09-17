import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AuthSession, User } from '../../../src/domain/index.js'
import { query, queryOne, transaction } from '../db/pool.js'
import { ApiError, invalid } from '../lib/errors.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { currentUser, issueSessionFor } from './helpers.js'
import { revokeSession } from '../auth/session.js'

const credentials = z.object({
  email: z.string().trim().min(1, 'Email is required').email('That does not look like an email'),
  password: z.string().min(8, 'Use at least 8 characters'),
})

const registration = credentials.extend({
  name: z.string().trim().min(1, 'Name is required').max(120),
})

interface UserRow {
  id: string
  name: string
  email: string
  password_hash: string | null
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', async (request): Promise<AuthSession> => {
    const { email, password } = credentials.parse(request.body)

    const user = await queryOne<UserRow>(
      'SELECT id, name, email, password_hash FROM users WHERE lower(email) = lower($1)',
      [email],
    )

    // Hash against a dummy when the user is missing so a wrong email and a
    // wrong password take the same time to answer, and say the same thing.
    const ok = user
      ? await verifyPassword(password, user.password_hash)
      : await verifyPassword(password, null)

    if (!user || !ok) throw new ApiError('unauthorized', 'That email and password do not match')

    return issueSessionFor({ id: user.id, name: user.name, email: user.email })
  })

  app.post('/auth/register', async (request): Promise<AuthSession> => {
    const { name, email, password } = registration.parse(request.body)

    const existing = await queryOne<{ id: string; password_hash: string | null }>(
      'SELECT id, password_hash FROM users WHERE lower(email) = lower($1)',
      [email],
    )
    // A pending invite creates the user row before they have a password, so
    // registering with that address claims the account instead of colliding.
    if (existing && existing.password_hash !== null) {
      throw invalid('An account with that email already exists')
    }

    const passwordHash = await hashPassword(password)

    const user = await transaction(async (client) => {
      let row: UserRow | null
      if (existing) {
        row = await queryOne<UserRow>(
          `UPDATE users SET name = $2, password_hash = $3 WHERE id = $1
           RETURNING id, name, email, password_hash`,
          [existing.id, name, passwordHash],
          client,
        )
        await client.query(
          "UPDATE memberships SET status = 'active' WHERE user_id = $1 AND status = 'invited'",
          [existing.id],
        )
      } else {
        row = await queryOne<UserRow>(
          `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
           RETURNING id, name, email, password_hash`,
          [name, email, passwordHash],
          client,
        )
      }
      if (!row) throw new ApiError('unknown', 'Could not create the account')

      // Everyone gets their own organization, so a new account has somewhere
      // to put a property without a separate setup step.
      const hasOrg = await queryOne<{ org_id: string }>(
        'SELECT org_id FROM memberships WHERE user_id = $1 LIMIT 1',
        [row.id],
        client,
      )
      if (!hasOrg) {
        const org = await queryOne<{ id: string }>(
          'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
          [`${name.split(' ')[0]}'s home`],
          client,
        )
        if (!org) throw new ApiError('unknown', 'Could not create the organization')
        await client.query(
          "INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, 'owner', 'active')",
          [org.id, row.id],
        )
        await client.query(
          `INSERT INTO subscriptions (org_id, plan_id, status, current_period_end)
           VALUES ($1, 'starter', 'trialing', now() + interval '30 days')`,
          [org.id],
        )
      }

      return row
    })

    return issueSessionFor({ id: user.id, name: user.name, email: user.email })
  })

  app.get('/auth/me', async (request): Promise<User | null> => {
    const user = request.sessionUser
    return user ? { id: user.id, name: user.name, email: user.email } : null
  })

  app.post('/auth/refresh', async (request): Promise<AuthSession> => {
    const user = currentUser(request)
    // Rotate: a new token is issued and the presented one is dropped, so a
    // refresh does not leave a second live credential behind.
    const session = await issueSessionFor(user)
    if (request.sessionToken) await revokeSession(request.sessionToken)
    return session
  })

  app.post('/auth/logout', async (request, reply) => {
    if (request.sessionToken) await revokeSession(request.sessionToken)
    return reply.status(204).send()
  })

  app.delete('/auth/sessions', async (request, reply) => {
    const user = currentUser(request)
    await query('DELETE FROM sessions WHERE user_id = $1', [user.id])
    return reply.status(204).send()
  })
}
