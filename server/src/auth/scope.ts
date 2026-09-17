import type { FastifyRequest } from 'fastify'
import type { Role } from '../../../src/domain/user.js'
import { queryOne, type Queryable } from '../db/pool.js'
import { forbidden, notFound, unauthorized } from '../lib/errors.js'
import type { SessionUser } from './session.js'

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type DbRole = 'owner' | 'admin' | 'member'

const RANK: Record<DbRole, number> = { member: 1, admin: 2, owner: 3 }

export const ROLE_TO_DOMAIN: Record<DbRole, Role> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export const ROLE_FROM_DOMAIN: Record<Role, DbRole> = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
}

/**
 * What each rank may do, in one place:
 *   member - read everything, and write asset records. This is a household
 *            app; the person who changes the filter has to be able to log it.
 *   admin  - the above, plus properties, vendors and who else has access.
 *   owner  - the above, plus billing and deleting the organization.
 */
export function hasRole(actual: DbRole, required: DbRole): boolean {
  return RANK[actual] >= RANK[required]
}

// ---------------------------------------------------------------------------
// Request identity
// ---------------------------------------------------------------------------

export function currentUser(request: FastifyRequest): SessionUser {
  const user = request.sessionUser
  if (!user) throw unauthorized()
  return user
}

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

/**
 * Every record in the asset half reaches an organization by walking up to its
 * property. Rather than repeat those joins in each route - where forgetting
 * one is a cross-tenant read - each resource declares the walk once here, and
 * routes call `requireScope` with the id they were given.
 */
const OWNER_SQL = {
  property: 'SELECT org_id FROM properties WHERE id = $1',
  location:
    'SELECT p.org_id FROM locations l JOIN properties p ON p.id = l.property_id WHERE l.id = $1',
  asset: 'SELECT p.org_id FROM assets a JOIN properties p ON p.id = a.property_id WHERE a.id = $1',
  warranty: `SELECT p.org_id FROM warranties w
               JOIN assets a ON a.id = w.asset_id
               JOIN properties p ON p.id = a.property_id
              WHERE w.id = $1`,
  consumable: `SELECT p.org_id FROM consumables c
                 JOIN assets a ON a.id = c.asset_id
                 JOIN properties p ON p.id = a.property_id
                WHERE c.id = $1`,
  task: `SELECT p.org_id FROM maintenance_tasks t
           JOIN properties p ON p.id = t.property_id
          WHERE t.id = $1`,
  event: `SELECT p.org_id FROM service_events e
            JOIN assets a ON a.id = e.asset_id
            JOIN properties p ON p.id = a.property_id
           WHERE e.id = $1`,
  document:
    'SELECT p.org_id FROM documents d JOIN properties p ON p.id = d.property_id WHERE d.id = $1',
  accessPoint:
    'SELECT p.org_id FROM access_points ap JOIN properties p ON p.id = ap.property_id WHERE ap.id = $1',
  zone: `SELECT p.org_id FROM irrigation_zones z
           JOIN assets a ON a.id = z.controller_asset_id
           JOIN properties p ON p.id = a.property_id
          WHERE z.id = $1`,
  vendor: 'SELECT org_id FROM vendors WHERE id = $1',
} as const

export type ScopeKind = keyof typeof OWNER_SQL

const LABELS: Record<ScopeKind, string> = {
  property: 'That property',
  location: 'That location',
  asset: 'That asset',
  warranty: 'That warranty',
  consumable: 'That consumable',
  task: 'That task',
  event: 'That service record',
  document: 'That document',
  accessPoint: 'That access point',
  zone: 'That zone',
  vendor: 'That vendor',
}

export interface Scope {
  orgId: string
  role: DbRole
  userId: string
}

/** The caller's role in an organization, or null when they are not a member. */
export async function roleInOrg(
  userId: string,
  orgId: string,
  client?: Queryable,
): Promise<DbRole | null> {
  const row = await queryOne<{ role: DbRole; status: string }>(
    'SELECT role, status FROM memberships WHERE user_id = $1 AND org_id = $2',
    [userId, orgId],
    client,
  )
  if (!row || row.status !== 'active') return null
  return row.role
}

/** Asserts the caller is a member of `orgId` with at least `minRole`. */
export async function requireOrg(
  request: FastifyRequest,
  orgId: string,
  minRole: DbRole = 'member',
): Promise<Scope> {
  const user = currentUser(request)
  const role = await roleInOrg(user.id, orgId)
  // A non-member gets 404, not 403: confirming an organization exists to
  // someone with no access is itself a leak.
  if (!role) throw notFound('That organization')
  if (!hasRole(role, minRole)) throw forbidden(`This needs ${minRole} access`)
  return { orgId, role, userId: user.id }
}

/**
 * Resolves the organization owning a record and asserts the caller's access.
 * A record in someone else's organization reads as missing, for the same
 * reason as above.
 */
export async function requireScope(
  request: FastifyRequest,
  kind: ScopeKind,
  id: string,
  minRole: DbRole = 'member',
): Promise<Scope> {
  const user = currentUser(request)
  const row = await queryOne<{ org_id: string }>(OWNER_SQL[kind], [id])
  if (!row) throw notFound(LABELS[kind])

  const role = await roleInOrg(user.id, row.org_id)
  if (!role) throw notFound(LABELS[kind])
  if (!hasRole(role, minRole)) throw forbidden(`This needs ${minRole} access`)
  return { orgId: row.org_id, role, userId: user.id }
}
