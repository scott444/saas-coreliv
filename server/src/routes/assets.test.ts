import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  closeTestApi,
  createTestApi,
  describeApi,
  seedDemoWorld,
  type DemoWorld,
  type TestApi,
} from '../test/harness.js'

/**
 * The register and the asset page: what the server derives, and what it
 * refuses.
 *
 * The derived warranty state matters most here - it is computed on the server
 * with the same domain function the asset page uses for a single warranty, so
 * a badge in a list and a badge on a page can never disagree.
 */
describeApi('assets', () => {
  let api: TestApi
  let world: DemoWorld

  beforeAll(async () => {
    api = await createTestApi()
    world = await seedDemoWorld(api)
  })

  afterAll(async () => {
    await closeTestApi(api)
  })

  const as = () => api.as(world.token)

  async function register() {
    const result = await as().get(`/api/orgs/${world.orgId}/assets`)
    expect(result.status).toBe(200)
    return result.body as Array<Record<string, any>>
  }

  const find = (entries: Array<Record<string, any>>, name: string) =>
    entries.find((entry) => entry.name === name)!

  it('joins the labels a list needs so the client makes one request', async () => {
    const furnace = find(await register(), 'Furnace')

    expect(furnace).toMatchObject({
      propertyName: 'Maple Street',
      categoryName: 'Furnace',
      groupName: 'HVAC',
      locationName: 'Mechanical room',
      brand: 'Carrier',
    })
  })

  it('derives every warranty state the badge can show', async () => {
    const entries = await register()
    const states = new Set(entries.map((e) => e.warranty.state))

    // The seed exists partly to guarantee this: all five states present, so
    // the register's tiles all have something to count.
    expect(states).toContain('expiring')
    expect(states).toContain('expired')
    expect(states).toContain('lifetime')
    expect(states).toContain('unknown')
    expect(states).toContain('active')
  })

  it('reports no warranty as unknown, which is not the same as expired', async () => {
    const septic = find(await register(), 'Septic system')
    expect(septic.warranty).toEqual({
      state: 'unknown',
      daysRemaining: null,
      warrantyId: null,
    })
  })

  it('picks the longest-running live warranty when an asset has several', async () => {
    const entries = await register()
    const furnace = find(entries, 'Furnace')
    const detail = await as().get(`/api/assets/${furnace.id}`)

    // The furnace carries an expiring parts warranty and a long-expired
    // labour one; the live one wins.
    expect(detail.body.warranties.length).toBeGreaterThan(1)
    expect(furnace.warranty.state).toBe('expiring')
    expect(furnace.warranty.warrantyId).toBe(
      detail.body.warranties.find((w: { kind: string }) => w.kind === 'manufacturer_parts').id,
    )
  })

  it('filters server-side by property, category and search', async () => {
    const all = await register()
    const cabinId = world.propertyIds.find((id) =>
      all.some((e) => e.propertyId === id && e.propertyName === 'Lake cabin'),
    )

    const byProperty = await as().get(`/api/orgs/${world.orgId}/assets?propertyId=${cabinId}`)
    expect(byProperty.body.length).toBeGreaterThan(0)
    expect(byProperty.body.every((e: { propertyName: string }) => e.propertyName === 'Lake cabin')).toBe(true)

    const bySearch = await as().get(`/api/orgs/${world.orgId}/assets?search=Rheem`)
    expect(bySearch.body).toHaveLength(1)
    expect(bySearch.body[0].name).toBe('Water heater')

    // Searching a serial, which is the reason the register exists.
    const bySerial = await as().get(`/api/orgs/${world.orgId}/assets?search=4218A93472`)
    expect(bySerial.body[0].name).toBe('Furnace')
  })

  it('matches a category group as well as a leaf', async () => {
    const categories = await as().get('/api/categories')
    const hvac = (categories.body as Array<{ id: string; slug: string }>).find((c) => c.slug === 'hvac')!

    const result = await as().get(`/api/orgs/${world.orgId}/assets?categoryId=${hvac.id}`)
    const names = (result.body as Array<{ name: string }>).map((e) => e.name)

    // Picking "HVAC" has to show the furnace filed under it.
    expect(names).toContain('Furnace')
    expect(names).toContain('AC condenser')
  })

  it('returns the whole asset page in one request', async () => {
    const furnace = find(await register(), 'Furnace')
    const detail = await as().get(`/api/assets/${furnace.id}`)

    expect(detail.status).toBe(200)
    expect(detail.body.asset.name).toBe('Furnace')
    expect(detail.body.property.name).toBe('Maple Street')
    expect(detail.body.category.slug).toBe('furnace')
    expect(detail.body.installer.name).toBe('Comfort Systems HVAC')
    expect(detail.body.warranties.length).toBeGreaterThan(0)
    expect(detail.body.consumables.length).toBeGreaterThan(0)
    expect(detail.body.events.length).toBeGreaterThan(0)
    expect(detail.body.documents.length).toBeGreaterThan(0)
    // The AC condenser hangs off the furnace as its parent.
    expect(detail.body.children.map((c: { name: string }) => c.name)).toContain('AC condenser')
  })

  it('reports a replacement projection from the in-service date and lifespan', async () => {
    const furnace = find(await register(), 'Furnace')
    const detail = await as().get(`/api/assets/${furnace.id}`)

    expect(detail.body.replacement).toMatchObject({
      expectedLifespanYears: 20,
      acquisitionCost: 4600,
    })
    expect(detail.body.replacement.projectedReplacement).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(detail.body.replacement.lifetimeServiceCost).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  it('round-trips an asset through create, read and update', async () => {
    const created = await as().post(`/api/properties/${world.propertyIds[0]}/assets`, {
      name: 'Test dehumidifier',
      brand: 'Frigidaire',
      modelNumber: 'FFAD5033W1',
      serialNumber: 'FR-9981',
      installDate: '2025-04-01',
      purchaseCost: 249.99,
      expectedLifespanYears: 8,
      specs: { capacity_pints: 50 },
      tags: ['basement', 'basement'],
    })

    expect(created.status).toBe(201)
    expect(created.body.purchaseCost).toBe(249.99)
    // Tags are de-duplicated on the way in.
    expect(created.body.tags).toEqual(['basement'])

    const updated = await as().put(`/api/assets/${created.body.id}`, {
      name: 'Basement dehumidifier',
      status: 'needs_repair',
      specs: { capacity_pints: 50, drain: 'pump' },
      tags: ['basement', 'noisy'],
    })

    expect(updated.status).toBe(200)
    expect(updated.body.name).toBe('Basement dehumidifier')
    expect(updated.body.status).toBe('needs_repair')
    expect(updated.body.specs).toEqual({ capacity_pints: 50, drain: 'pump' })
    expect([...updated.body.tags].sort()).toEqual(['basement', 'noisy'])

    // updated_at is maintained by a trigger, not by the route.
    expect(updated.body.updatedAt).not.toBe(created.body.updatedAt)

    const removed = await as().del(`/api/assets/${created.body.id}`)
    expect(removed.status).toBe(204)
    expect((await as().get(`/api/assets/${created.body.id}`)).status).toBe(404)
  })

  it('rejects an install date before the purchase date, from the schema check', async () => {
    const result = await as().post(`/api/properties/${world.propertyIds[0]}/assets`, {
      name: 'Impossible order',
      purchaseDate: '2025-06-01',
      installDate: '2025-01-01',
      specs: {},
      tags: [],
    })

    // The CHECK constraint fires; the error handler turns it into validation
    // rather than letting a 500 out.
    expect(result.status).toBe(422)
    expect(result.body.code).toBe('validation')
  })

  it('rejects a room that belongs to a different property', async () => {
    const [housePropertyId, cabinPropertyId] = world.propertyIds
    const cabinRooms = await as().get(`/api/properties/${cabinPropertyId}/locations`)

    const result = await as().post(`/api/properties/${housePropertyId}/assets`, {
      name: 'Misfiled',
      locationId: cabinRooms.body[0].id,
      specs: {},
      tags: [],
    })

    expect(result.status).toBe(422)
    expect(result.body.message).toMatch(/different property/)
  })

  it('refuses to let an asset be its own parent', async () => {
    const furnace = find(await register(), 'Furnace')
    const result = await as().put(`/api/assets/${furnace.id}`, {
      name: 'Furnace',
      parentAssetId: furnace.id,
      specs: {},
      tags: [],
    })

    expect(result.status).toBe(422)
    expect(result.body.message).toMatch(/its own parent/)
  })

  it('rejects a warranty whose cover ends before it starts', async () => {
    const furnace = find(await register(), 'Furnace')
    const result = await as().post(`/api/assets/${furnace.id}/warranties`, {
      kind: 'extended',
      startDate: '2026-01-01',
      endDate: '2025-01-01',
      registered: false,
    })

    expect(result.status).toBe(422)
    expect(result.body.message).toMatch(/end before it starts/)
  })

  it('rejects half an interval on a consumable', async () => {
    const furnace = find(await register(), 'Furnace')
    const result = await as().post(`/api/assets/${furnace.id}/consumables`, {
      name: 'Half-specified',
      intervalValue: 3,
      intervalUnit: null,
    })

    expect(result.status).toBe(422)
    expect(result.body.message).toMatch(/both a number and a unit/)
  })

  it('upserts an irrigation zone on its zone number', async () => {
    const controller = find(await register(), 'Irrigation controller')

    const saved = await as().put(`/api/assets/${controller.id}/zones`, {
      zoneNumber: 1,
      name: 'Front lawn - renamed',
      runMinutes: 30,
      schedule: { days: ['mon'], start: '04:00' },
    })

    expect(saved.status).toBe(200)
    expect(saved.body.name).toBe('Front lawn - renamed')

    // The zone number is the natural key on a controller, so saving it again
    // edits rather than duplicating.
    const zones = await as().get(`/api/assets/${controller.id}/zones`)
    expect(zones.body.filter((z: { zoneNumber: number }) => z.zoneNumber === 1)).toHaveLength(1)
    expect(zones.body[0].schedule).toEqual({ days: ['mon'], start: '04:00' })
  })

  it('reports a bad uuid as validation, not as a crash', async () => {
    const result = await as().get('/api/assets/not-a-uuid')
    expect(result.status).toBe(422)
    expect(result.body.code).toBe('validation')
  })
})
