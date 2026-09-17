import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Plan, RedirectTarget, Subscription, SubscriptionStatus } from '../../../src/domain/index.js'
import { query, queryOne } from '../db/pool.js'
import { invalid, notFound } from '../lib/errors.js'
import { orgParams, requireOrg } from './helpers.js'

type DbStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

const STATUS: Record<DbStatus, SubscriptionStatus> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'PastDue',
  canceled: 'Canceled',
}

interface SubscriptionRow {
  planId: string
  status: DbStatus
  currentPeriodEnd: string
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    planId: row.planId,
    status: STATUS[row.status],
    currentPeriodEnd: row.currentPeriodEnd,
  }
}

async function readSubscription(orgId: string): Promise<Subscription> {
  const row = await queryOne<SubscriptionRow>(
    `SELECT plan_id AS "planId", status, current_period_end AS "currentPeriodEnd"
       FROM subscriptions WHERE org_id = $1`,
    [orgId],
  )
  if (!row) throw notFound('That subscription')
  return toSubscription(row)
}

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // Public: the pricing table renders before anyone signs in.
  app.get('/billing/plans', async (): Promise<Plan[]> =>
    query<Plan>(
      `SELECT id, name, price_monthly AS "priceMonthly", features, asset_limit AS "assetLimit"
         FROM plans ORDER BY sort_order`,
    ),
  )

  app.get('/orgs/:orgId/subscription', async (request): Promise<Subscription> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)
    return readSubscription(orgId)
  })

  /**
   * Stands in for a payment provider.
   *
   * A real integration would create a Checkout Session here, return its URL,
   * and move the subscription only when the provider's webhook confirmed
   * payment. There is no provider wired up yet, so this applies the change
   * directly - the same state transition, minus the money - and hands back an
   * in-app return URL. Swapping in Stripe means replacing the body of these
   * three handlers and adding a webhook route; nothing else in the app reads
   * the subscription any other way.
   */
  app.post('/orgs/:orgId/checkout', async (request): Promise<RedirectTarget> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId, 'owner')
    const { planId } = z.object({ planId: z.string().trim().min(1) }).parse(request.body)

    const plan = await queryOne<{ id: string }>('SELECT id FROM plans WHERE id = $1', [planId])
    if (!plan) throw invalid('No such plan')

    await query(
      `UPDATE subscriptions
          SET plan_id = $2, status = 'active', current_period_end = now() + interval '1 month'
        WHERE org_id = $1`,
      [orgId, planId],
    )

    return { url: `/billing/return?status=success&plan=${encodeURIComponent(planId)}` }
  })

  app.post('/orgs/:orgId/portal', async (request): Promise<RedirectTarget> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId, 'owner')

    // A provider portal is where a past-due card gets fixed, so returning
    // from it settles the subscription.
    await query(
      `UPDATE subscriptions
          SET status = 'active', current_period_end = greatest(current_period_end, now() + interval '1 month')
        WHERE org_id = $1 AND status = 'past_due'`,
      [orgId],
    )

    return { url: '/billing/return?status=portal' }
  })

  app.post('/orgs/:orgId/cancel', async (request): Promise<Subscription> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId, 'owner')

    await query(
      "UPDATE subscriptions SET status = 'canceled', plan_id = 'starter' WHERE org_id = $1",
      [orgId],
    )
    return readSubscription(orgId)
  })
}
