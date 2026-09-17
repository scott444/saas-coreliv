import { ApiError } from './errors.js'
import { queryOne, type Queryable } from '../db/pool.js'

interface LimitRow {
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  assetLimit: number | null
  propertyLimit: number | null
  memberLimit: number | null
}

async function limitsFor(orgId: string, client?: Queryable): Promise<LimitRow> {
  const row = await queryOne<LimitRow>(
    `SELECT s.status,
            p.asset_limit    AS "assetLimit",
            p.property_limit AS "propertyLimit",
            p.member_limit   AS "memberLimit"
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.org_id = $1`,
    [orgId],
    client,
  )
  // An organization with no subscription row predates billing or was created
  // by hand; treat it as the free plan rather than letting it write freely.
  return row ?? { status: 'trialing', assetLimit: 25, propertyLimit: 1, memberLimit: 1 }
}

/**
 * Whether the organization may write at all.
 *
 * `past_due` deliberately still writes: dunning is a payment problem, and
 * locking someone out of their own service history over a declined card is a
 * worse outcome than carrying them for a cycle. Only an outright cancellation
 * makes the account read-only.
 */
export async function assertWritable(orgId: string, client?: Queryable): Promise<void> {
  const { status } = await limitsFor(orgId, client)
  if (status === 'canceled') {
    throw new ApiError(
      'subscription_expired',
      'This subscription has been cancelled. Reactivate a plan to make changes.',
    )
  }
}

async function assertUnder(
  orgId: string,
  limit: number | null,
  countSql: string,
  message: (limit: number) => string,
  client?: Queryable,
): Promise<void> {
  if (limit === null) return
  const row = await queryOne<{ count: number }>(countSql, [orgId], client)
  if ((row?.count ?? 0) >= limit) throw new ApiError('limit_exceeded', message(limit))
}

export async function assertCanAddAsset(orgId: string, client?: Queryable): Promise<void> {
  await assertWritable(orgId, client)
  const { assetLimit } = await limitsFor(orgId, client)
  await assertUnder(
    orgId,
    assetLimit,
    `SELECT count(*)::int AS count FROM assets a
       JOIN properties p ON p.id = a.property_id WHERE p.org_id = $1`,
    (limit) => `Your plan covers ${limit} assets. Upgrade to add more.`,
    client,
  )
}

export async function assertCanAddProperty(orgId: string, client?: Queryable): Promise<void> {
  await assertWritable(orgId, client)
  const { propertyLimit } = await limitsFor(orgId, client)
  await assertUnder(
    orgId,
    propertyLimit,
    'SELECT count(*)::int AS count FROM properties WHERE org_id = $1',
    (limit) =>
      limit === 1
        ? 'Your plan covers one property. Upgrade to track more than one.'
        : `Your plan covers ${limit} properties. Upgrade to add more.`,
    client,
  )
}

export async function assertCanAddMember(orgId: string, client?: Queryable): Promise<void> {
  await assertWritable(orgId, client)
  const { memberLimit } = await limitsFor(orgId, client)
  await assertUnder(
    orgId,
    memberLimit,
    'SELECT count(*)::int AS count FROM memberships WHERE org_id = $1',
    (limit) =>
      limit === 1
        ? 'Your plan is for one person. Upgrade to share access.'
        : `Your plan covers ${limit} people. Upgrade to invite more.`,
    client,
  )
}
