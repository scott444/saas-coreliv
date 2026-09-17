import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Member, Organization } from '../../../src/domain/index.js'
import { query, queryOne, transaction } from '../db/pool.js'
import { conflict, invalid, notFound } from '../lib/errors.js'
import { ROLE_FROM_DOMAIN, ROLE_TO_DOMAIN, type DbRole } from '../auth/scope.js'
import { currentUser, orgParams, requireOrg, uuid } from './helpers.js'

const roleInput = z.object({ role: z.enum(['Owner', 'Admin', 'Member']) })

const inviteInput = roleInput.extend({
  email: z.string().trim().min(1, 'Email is required').email('That does not look like an email'),
})

const memberParams = orgParams.extend({ userId: uuid })

interface MemberRow {
  id: string
  name: string
  email: string
  role: DbRole
  joinedAt: string
  status: 'active' | 'invited'
}

const MEMBER_SELECT = `
  SELECT u.id, u.name, u.email, m.role, m.joined_at AS "joinedAt", m.status
    FROM memberships m
    JOIN users u ON u.id = m.user_id
   WHERE m.org_id = $1
`

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: ROLE_TO_DOMAIN[row.role],
    joinedAt: row.joinedAt,
    status: row.status === 'active' ? 'Active' : 'Invited',
  }
}

/** An organization must never be left without an owner who can reach billing. */
async function assertNotLastOwner(orgId: string, userId: string): Promise<void> {
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM memberships
      WHERE org_id = $1 AND role = 'owner' AND status = 'active' AND user_id <> $2`,
    [orgId, userId],
  )
  if ((row?.count ?? 0) === 0) {
    throw conflict('Make someone else an owner first - an organization needs one')
  }
}

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/orgs', async (request): Promise<Organization[]> => {
    const user = currentUser(request)
    return query<Organization>(
      `SELECT o.id,
              o.name,
              m.role,
              (SELECT count(*)::int FROM memberships x WHERE x.org_id = o.id)  AS "memberCount",
              (SELECT count(*)::int FROM properties p WHERE p.org_id = o.id)   AS "propertyCount"
         FROM memberships m
         JOIN organizations o ON o.id = m.org_id
        WHERE m.user_id = $1 AND m.status = 'active'
        ORDER BY o.created_at`,
      [user.id],
    ).then((rows) =>
      rows.map((row) => ({ ...row, role: ROLE_TO_DOMAIN[row.role as unknown as DbRole] })),
    )
  })

  app.get('/orgs/:orgId', async (request): Promise<Organization> => {
    const { orgId } = orgParams.parse(request.params)
    const scope = await requireOrg(request, orgId)

    const row = await queryOne<Omit<Organization, 'role'>>(
      `SELECT o.id,
              o.name,
              (SELECT count(*)::int FROM memberships x WHERE x.org_id = o.id) AS "memberCount",
              (SELECT count(*)::int FROM properties p WHERE p.org_id = o.id)  AS "propertyCount"
         FROM organizations o WHERE o.id = $1`,
      [orgId],
    )
    if (!row) throw notFound('That organization')
    return { ...row, role: ROLE_TO_DOMAIN[scope.role] }
  })

  app.patch('/orgs/:orgId', async (request): Promise<Organization> => {
    const { orgId } = orgParams.parse(request.params)
    const scope = await requireOrg(request, orgId, 'admin')
    const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(request.body)

    const row = await queryOne<Omit<Organization, 'role'>>(
      `UPDATE organizations SET name = $2 WHERE id = $1
       RETURNING id, name,
         (SELECT count(*)::int FROM memberships x WHERE x.org_id = organizations.id) AS "memberCount",
         (SELECT count(*)::int FROM properties p WHERE p.org_id = organizations.id)  AS "propertyCount"`,
      [orgId, name],
    )
    if (!row) throw notFound('That organization')
    return { ...row, role: ROLE_TO_DOMAIN[scope.role] }
  })

  app.get('/orgs/:orgId/members', async (request): Promise<Member[]> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)
    const rows = await query<MemberRow>(
      `${MEMBER_SELECT} ORDER BY m.role, u.name`,
      [orgId],
    )
    return rows.map(toMember)
  })

  app.post('/orgs/:orgId/members', async (request, reply): Promise<Member> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId, 'admin')
    const { email, role } = inviteInput.parse(request.body)

    const member = await transaction(async (client) => {
      // Invite by email, which may or may not already be an account. Creating
      // a password-less user row means the membership is real immediately and
      // registering with that address later just claims it.
      let user = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE lower(email) = lower($1)',
        [email],
        client,
      )
      if (!user) {
        user = await queryOne<{ id: string }>(
          'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
          [email.split('@')[0] ?? email, email],
          client,
        )
      }
      if (!user) throw invalid('Could not create that invitation')

      const already = await queryOne<{ user_id: string }>(
        'SELECT user_id FROM memberships WHERE org_id = $1 AND user_id = $2',
        [orgId, user.id],
        client,
      )
      if (already) throw conflict('That person is already on this organization')

      await client.query(
        'INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, $3, $4)',
        [orgId, user.id, ROLE_FROM_DOMAIN[role], 'invited'],
      )

      return queryOne<MemberRow>(`${MEMBER_SELECT} AND u.id = $2`, [orgId, user.id], client)
    })

    if (!member) throw invalid('Could not create that invitation')
    return reply.status(201).send(toMember(member))
  })

  app.patch('/orgs/:orgId/members/:userId', async (request): Promise<Member> => {
    const { orgId, userId } = memberParams.parse(request.params)
    const scope = await requireOrg(request, orgId, 'admin')
    const { role } = roleInput.parse(request.body)
    const next = ROLE_FROM_DOMAIN[role]

    const target = await queryOne<{ role: DbRole }>(
      'SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2',
      [orgId, userId],
    )
    if (!target) throw notFound('That member')

    // Only an owner can appoint or unseat another owner; an admin promoting
    // themselves would otherwise be one request away from taking billing.
    if ((target.role === 'owner' || next === 'owner') && scope.role !== 'owner') {
      throw invalid('Only an owner can change owner access')
    }
    if (target.role === 'owner' && next !== 'owner') await assertNotLastOwner(orgId, userId)

    const row = await queryOne<MemberRow>(
      `UPDATE memberships SET role = $3 WHERE org_id = $1 AND user_id = $2
       RETURNING (SELECT id FROM users WHERE id = $2) AS id,
                 (SELECT name FROM users WHERE id = $2) AS name,
                 (SELECT email FROM users WHERE id = $2) AS email,
                 role, joined_at AS "joinedAt", status`,
      [orgId, userId, next],
    )
    if (!row) throw notFound('That member')
    return toMember(row)
  })

  app.delete('/orgs/:orgId/members/:userId', async (request, reply) => {
    const { orgId, userId } = memberParams.parse(request.params)
    const scope = await requireOrg(request, orgId, 'admin')

    const target = await queryOne<{ role: DbRole }>(
      'SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2',
      [orgId, userId],
    )
    if (!target) throw notFound('That member')
    if (target.role === 'owner') {
      if (scope.role !== 'owner') throw invalid('Only an owner can remove another owner')
      await assertNotLastOwner(orgId, userId)
    }

    await query('DELETE FROM memberships WHERE org_id = $1 AND user_id = $2', [orgId, userId])
    // Their sessions stay valid for other organizations; the next request
    // scoped to this one simply stops resolving.
    return reply.status(204).send()
  })
}
