import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  closeTestApi,
  createTestApi,
  describeApi,
  registerFreshUser,
  seedDemoWorld,
  type DemoWorld,
  type TestApi,
} from '../test/harness.js'

/**
 * Isolation between organizations, and the roles inside one.
 *
 * These are the assertions that have to hold against the real query plans:
 * `requireScope` resolves an owner through a chain of joins, and a mistake in
 * any of them is a cross-tenant read that no amount of front-end testing
 * would notice.
 */
describeApi('tenancy', () => {
  let api: TestApi
  let world: DemoWorld
  let stranger: { token: string; orgId: string }

  beforeAll(async () => {
    api = await createTestApi()
    world = await seedDemoWorld(api)
    stranger = await registerFreshUser(api, 'stranger@example.com')
  })

  afterAll(async () => {
    await closeTestApi(api)
  })

  async function demoAssetId(): Promise<string> {
    const register = await api.as(world.token).get(`/api/orgs/${world.orgId}/assets`)
    return register.body[0].id as string
  }

  it('refuses every request without a token', async () => {
    const results = await Promise.all([
      api.anon.get(`/api/orgs/${world.orgId}/assets`),
      api.anon.get(`/api/orgs/${world.orgId}/vendors`),
      api.anon.get('/api/categories'),
    ])
    for (const result of results) {
      expect(result.status).toBe(401)
      expect(result.body.code).toBe('unauthorized')
    }
  })

  it('leaves the plan list public, since pricing renders before sign-in', async () => {
    const result = await api.anon.get('/api/billing/plans')
    expect(result.status).toBe(200)
    expect(result.body.length).toBeGreaterThan(0)
  })

  it('hides another organization behind 404 rather than 403', async () => {
    // 403 would confirm the organization exists, which is itself a leak.
    const result = await api.as(stranger.token).get(`/api/orgs/${world.orgId}/assets`)
    expect(result.status).toBe(404)
    expect(result.body.code).toBe('not_found')
  })

  it('hides individual records the same way, through every join', async () => {
    const assetId = await demoAssetId()
    const detail = await api.as(world.token).get(`/api/assets/${assetId}`)
    const warrantyId = detail.body.warranties[0]?.id

    const asStranger = api.as(stranger.token)
    expect((await asStranger.get(`/api/assets/${assetId}`)).status).toBe(404)
    expect((await asStranger.put(`/api/assets/${assetId}`, { name: 'Mine now', specs: {}, tags: [] })).status).toBe(404)
    expect((await asStranger.del(`/api/assets/${assetId}`)).status).toBe(404)
    expect((await asStranger.get(`/api/properties/${world.propertyIds[0]}/locations`)).status).toBe(404)

    if (warrantyId) {
      expect((await asStranger.del(`/api/warranties/${warrantyId}`)).status).toBe(404)
    }
  })

  it('leaves the other organization untouched after a refused write', async () => {
    const assetId = await demoAssetId()
    await api.as(stranger.token).put(`/api/assets/${assetId}`, { name: 'Mine now', specs: {}, tags: [] })

    const detail = await api.as(world.token).get(`/api/assets/${assetId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.asset.name).not.toBe('Mine now')
  })

  it('rejects a foreign id supplied in a body, not just in the path', async () => {
    // Scoping only the path id would still let this attach another
    // organization's vendor to your own asset.
    const foreignVendors = await api.as(world.token).get(`/api/orgs/${world.orgId}/vendors`)
    const foreignVendorId = foreignVendors.body[0].id

    const own = await api.as(stranger.token).post(
      `/api/orgs/${stranger.orgId}/properties`,
      { name: 'Stranger house', address: null, yearBuilt: null, purchaseDate: null, notes: null },
    )
    expect(own.status).toBe(201)

    const created = await api.as(stranger.token).post(`/api/properties/${own.body.id}/assets`, {
      name: 'Borrowed vendor',
      installerId: foreignVendorId,
      specs: {},
      tags: [],
    })

    expect(created.status).toBe(422)
    expect(created.body.code).toBe('validation')
    expect(created.body.message).toMatch(/does not belong to this organization/)
  })

  it('lets a member write records but not manage properties', async () => {
    // sam is an admin in the seed; demote a fresh invite to member instead.
    const invited = await api.as(world.token).post(`/api/orgs/${world.orgId}/members`, {
      email: 'helper@example.com',
      role: 'Member',
    })
    expect(invited.status).toBe(201)
    expect(invited.body.status).toBe('Invited')

    const helper = await api.anon.post('/api/auth/register', {
      name: 'Helper',
      email: 'helper@example.com',
      password: 'a-good-password',
    })
    expect(helper.status).toBe(200)
    const helperToken = helper.body.accessToken

    // Registering against a pending invite activates that membership, so the
    // helper is now a member of the demo organization.
    const orgs = await api.as(helperToken).get('/api/orgs')
    const demo = orgs.body.find((o: { id: string }) => o.id === world.orgId)
    expect(demo.role).toBe('Member')

    // A member can log work...
    const register = await api.as(helperToken).get(`/api/orgs/${world.orgId}/assets`)
    expect(register.status).toBe(200)
    const logged = await api.as(helperToken).post(`/api/assets/${register.body[0].id}/events`, {
      kind: 'maintenance',
      occurredOn: '2026-01-15',
      summary: 'Changed the filter.',
    })
    expect(logged.status).toBe(201)

    // ...but not add a property, or invite anyone.
    const property = await api.as(helperToken).post(`/api/orgs/${world.orgId}/properties`, {
      name: 'Not allowed',
      address: null,
      yearBuilt: null,
      purchaseDate: null,
      notes: null,
    })
    expect(property.status).toBe(403)
    expect(property.body.code).toBe('forbidden')
  })

  it('will not leave an organization without an owner', async () => {
    const members = await api.as(world.token).get(`/api/orgs/${world.orgId}/members`)
    const owner = members.body.find((m: { role: string }) => m.role === 'Owner')

    const demoted = await api.as(world.token).patch(
      `/api/orgs/${world.orgId}/members/${owner.id}`,
      { role: 'Admin' },
    )

    expect(demoted.status).toBe(409)
    expect(demoted.body.code).toBe('conflict')
  })
})

describeApi('plan limits', () => {
  let api: TestApi
  let fresh: { token: string; orgId: string }

  beforeAll(async () => {
    api = await createTestApi()
    await seedDemoWorld(api)
    fresh = await registerFreshUser(api, 'limits@example.com')
  })

  afterAll(async () => {
    await closeTestApi(api)
  })

  it('puts a new account on the free plan with one property', async () => {
    const subscription = await api.as(fresh.token).get(`/api/orgs/${fresh.orgId}/subscription`)
    expect(subscription.body).toMatchObject({ planId: 'starter', status: 'Trialing' })

    const first = await api.as(fresh.token).post(`/api/orgs/${fresh.orgId}/properties`, {
      name: 'First house',
      address: null,
      yearBuilt: null,
      purchaseDate: null,
      notes: null,
    })
    expect(first.status).toBe(201)

    const second = await api.as(fresh.token).post(`/api/orgs/${fresh.orgId}/properties`, {
      name: 'Second house',
      address: null,
      yearBuilt: null,
      purchaseDate: null,
      notes: null,
    })
    expect(second.status).toBe(402)
    expect(second.body.code).toBe('limit_exceeded')
  })

  it('lifts the limit once the plan changes', async () => {
    const checkout = await api.as(fresh.token).post(`/api/orgs/${fresh.orgId}/checkout`, {
      planId: 'home',
    })
    expect(checkout.status).toBe(200)

    const second = await api.as(fresh.token).post(`/api/orgs/${fresh.orgId}/properties`, {
      name: 'Second house',
      address: null,
      yearBuilt: null,
      purchaseDate: null,
      notes: null,
    })
    expect(second.status).toBe(201)
  })

  it('makes a cancelled account read-only, but still readable', async () => {
    await api.as(fresh.token).post(`/api/orgs/${fresh.orgId}/cancel`)

    const read = await api.as(fresh.token).get(`/api/orgs/${fresh.orgId}/properties`)
    expect(read.status).toBe(200)
    expect(read.body.length).toBeGreaterThan(0)

    const write = await api.as(fresh.token).put(`/api/properties/${read.body[0].id}`, {
      name: 'Renamed',
      address: null,
      yearBuilt: null,
      purchaseDate: null,
      notes: null,
    })
    expect(write.status).toBe(402)
    expect(write.body.code).toBe('subscription_expired')
  })
})
