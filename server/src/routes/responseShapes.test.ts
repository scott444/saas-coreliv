import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  assertDateOnly,
  closeTestApi,
  createTestApi,
  describeApi,
  findRawDatabaseValues,
  seedDemoWorld,
  type DemoWorld,
  type TestApi,
} from '../test/harness.js'

/**
 * What the driver hands back, across every read endpoint.
 *
 * The bug that prompted this suite was not a logic error: `vendor_role[]` is
 * an array of a user-defined enum, node-postgres ships array parsers for
 * built-in OIDs only, and the raw literal `'{installer,service}'` reached the
 * browser as a string. Nothing in the app was wrong - the value simply never
 * became what the domain type said it was.
 *
 * Front-end tests could not catch it, because they run against a fake that
 * returns a real array. Only a request against real Postgres can.
 */
describeApi('response shapes', () => {
  let api: TestApi
  let world: DemoWorld

  beforeAll(async () => {
    api = await createTestApi()
    world = await seedDemoWorld(api)
  })

  afterAll(async () => {
    await closeTestApi(api)
  })

  async function get(url: string) {
    const result = await api.as(world.token).get(url)
    expect(result.status, `GET ${url} -> ${JSON.stringify(result.body)}`).toBe(200)
    return result.body
  }

  it('returns no unparsed Postgres arrays from any list endpoint', async () => {
    const [orgId] = [world.orgId]
    const urls = [
      '/api/orgs',
      '/api/categories',
      '/api/billing/plans',
      `/api/orgs/${orgId}/members`,
      `/api/orgs/${orgId}/subscription`,
      `/api/orgs/${orgId}/properties`,
      `/api/orgs/${orgId}/assets`,
      `/api/orgs/${orgId}/vendors`,
      `/api/orgs/${orgId}/tasks`,
      `/api/orgs/${orgId}/due`,
      `/api/orgs/${orgId}/documents`,
      `/api/orgs/${orgId}/replacement-plan`,
      `/api/properties/${world.propertyIds[0]}/locations`,
      `/api/properties/${world.propertyIds[0]}/access-points`,
    ]

    const problems: string[] = []
    for (const url of urls) {
      problems.push(...findRawDatabaseValues(await get(url), url))
    }

    expect(problems).toEqual([])
  })

  it('returns no unparsed Postgres arrays from any asset detail', async () => {
    const register = await get(`/api/orgs/${world.orgId}/assets`)

    // Every asset, not a sample: the categories differ, and it is the
    // irrigation controller with its zones and the furnace with its parts
    // lists that carry the interesting column types.
    const problems: string[] = []
    for (const entry of register as Array<{ id: string; name: string }>) {
      const detail = await get(`/api/assets/${entry.id}`)
      problems.push(...findRawDatabaseValues(detail, entry.name))
    }

    expect(problems).toEqual([])
  })

  it('parses vendor roles into an array of enum labels', async () => {
    const vendors = await get(`/api/orgs/${world.orgId}/vendors`)
    expect(vendors.length).toBeGreaterThan(0)

    for (const vendor of vendors) {
      expect(Array.isArray(vendor.roles), `${vendor.name}.roles`).toBe(true)
    }

    const hvac = vendors.find((v: { name: string }) => v.name === 'Comfort Systems HVAC')
    expect(hvac.roles).toEqual(['installer', 'service'])
  })

  it('parses the vendor roles reached through an asset as well', async () => {
    const register = await get(`/api/orgs/${world.orgId}/assets`)
    const furnace = register.find((a: { name: string }) => a.name === 'Furnace')
    const detail = await get(`/api/assets/${furnace.id}`)

    expect(Array.isArray(detail.installer.roles)).toBe(true)
    expect(detail.installer.roles).toContain('installer')
  })

  it('keeps calendar dates as YYYY-MM-DD rather than timestamps', async () => {
    const register = await get(`/api/orgs/${world.orgId}/assets`)
    for (const entry of register) {
      assertDateOnly(entry.installDate, `${entry.name}.installDate`)
      assertDateOnly(entry.purchaseDate, `${entry.name}.purchaseDate`)
      assertDateOnly(entry.lastServicedOn, `${entry.name}.lastServicedOn`)
    }

    const due = await get(`/api/orgs/${world.orgId}/due`)
    for (const item of due) {
      assertDateOnly(item.dueOn, `${item.itemName}.dueOn`)
      assertDateOnly(item.lastDoneOn, `${item.itemName}.lastDoneOn`)
    }

    const furnace = register.find((a: { name: string }) => a.name === 'Furnace')
    const detail = await get(`/api/assets/${furnace.id}`)
    for (const warranty of detail.warranties) {
      assertDateOnly(warranty.startDate, 'warranty.startDate')
      assertDateOnly(warranty.endDate, 'warranty.endDate')
    }
    assertDateOnly(detail.replacement.projectedReplacement, 'replacement.projectedReplacement')
  })

  it('returns money and counts as numbers, not the strings numeric arrives as', async () => {
    const register = await get(`/api/orgs/${world.orgId}/assets`)
    const furnace = register.find((a: { name: string }) => a.name === 'Furnace')
    const detail = await get(`/api/assets/${furnace.id}`)

    expect(typeof detail.asset.purchaseCost).toBe('number')
    expect(typeof detail.replacement.acquisitionCost).toBe('number')
    expect(typeof detail.replacement.lifetimeServiceCost).toBe('number')
    expect(detail.replacement.lifetimeServiceCost).toBeGreaterThan(0)

    const properties = await get(`/api/orgs/${world.orgId}/properties`)
    expect(typeof properties[0].assetCount).toBe('number')
    expect(typeof properties[0].openItemCount).toBe('number')
  })

  it('returns the category spec schema as structured JSON, not a string', async () => {
    const categories = await get('/api/categories')
    const furnace = categories.find((c: { slug: string }) => c.slug === 'furnace')

    expect(Array.isArray(furnace.specSchema)).toBe(true)
    expect(furnace.specSchema[0]).toMatchObject({ key: expect.any(String), type: expect.any(String) })

    // The form renders from this, so options have to survive as an array too.
    const fuel = furnace.specSchema.find((f: { key: string }) => f.key === 'fuel')
    expect(fuel.options).toContain('natural_gas')
  })

  it('returns asset specs and service readings as objects', async () => {
    const register = await get(`/api/orgs/${world.orgId}/assets`)
    const furnace = register.find((a: { name: string }) => a.name === 'Furnace')
    const detail = await get(`/api/assets/${furnace.id}`)

    expect(detail.asset.specs).toMatchObject({ fuel: 'natural_gas', afue: 96 })
    expect(Array.isArray(detail.asset.tags)).toBe(true)

    const withReadings = detail.events.find((e: { readings: unknown }) => e.readings !== null)
    expect(typeof withReadings.readings).toBe('object')
    expect(Array.isArray(withReadings.partsReplaced)).toBe(true)
  })
})
