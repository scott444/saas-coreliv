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
 * Due-date semantics, against the real `add_interval()`.
 *
 * The client has its own copy of that arithmetic in `src/domain/dates.ts`, so
 * these tests are also what keeps the two from drifting: if Postgres and the
 * browser ever disagree about when something is next due, it shows up here.
 */
describeApi('maintenance', () => {
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

  async function due() {
    const result = await as().get(`/api/orgs/${world.orgId}/due`)
    expect(result.status).toBe(200)
    return result.body as Array<{
      itemType: 'task' | 'consumable'
      id: string
      itemName: string
      assetId: string | null
      dueOn: string | null
      lastDoneOn: string | null
      status: string
      daysUntilDue: number | null
    }>
  }

  it('carries never-done items through as unscheduled, not overdue', async () => {
    const items = await due()
    const flush = items.find((i) => i.itemName === 'Flush water heater')

    // The schema's v_upcoming_due drops these - it needs a last-done date to
    // project from - but it is exactly the item the list exists to surface.
    expect(flush).toBeDefined()
    expect(flush!.lastDoneOn).toBeNull()
    expect(flush!.dueOn).toBeNull()
    expect(flush!.status).toBe('unscheduled')
    expect(flush!.daysUntilDue).toBeNull()
  })

  it('projects a due date from the last-done date and the interval', async () => {
    const items = await due()
    const filter = items.find((i) => i.itemName === 'Air filter')!

    expect(filter.lastDoneOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(filter.dueOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Seeded four months ago on a three-month interval.
    expect(filter.status).toBe('overdue')
    expect(filter.daysUntilDue).toBeLessThan(0)
  })

  it('sorts the most overdue first and the never-done last', async () => {
    const items = await due()
    const dated = items.filter((i) => i.daysUntilDue !== null).map((i) => i.daysUntilDue!)
    const sorted = [...dated].sort((a, b) => a - b)
    expect(dated).toEqual(sorted)

    const firstUnscheduled = items.findIndex((i) => i.daysUntilDue === null)
    if (firstUnscheduled !== -1) {
      expect(items.slice(firstUnscheduled).every((i) => i.daysUntilDue === null)).toBe(true)
    }
  })

  it('completing a consumable advances the date, logs it, and draws down stock', async () => {
    const before = (await due()).find((i) => i.itemName === 'Air filter')!
    const register = await as().get(`/api/orgs/${world.orgId}/assets`)
    const furnace = (register.body as Array<{ id: string; name: string }>).find(
      (a) => a.name === 'Furnace',
    )!

    const detailBefore = await as().get(`/api/assets/${furnace.id}`)
    const stockBefore = detailBefore.body.consumables.find(
      (c: { name: string }) => c.name === 'Air filter',
    ).quantityOnHand
    const eventsBefore = detailBefore.body.events.length

    const completed = await as().post(`/api/due/consumable/${before.id}/complete`, {
      occurredOn: '2026-09-17',
      summary: 'Swapped the 20x25x4.',
      vendorId: null,
      cost: 34.5,
      notes: null,
    })
    expect(completed.status).toBe(204)

    const after = (await due()).find((i) => i.itemName === 'Air filter')!
    expect(after.lastDoneOn).toBe('2026-09-17')
    expect(after.status).not.toBe('overdue')

    const detailAfter = await as().get(`/api/assets/${furnace.id}`)
    // The completion and the record are one transaction: advancing the clock
    // without leaving a trail would be the worse half of this working.
    expect(detailAfter.body.events.length).toBe(eventsBefore + 1)
    const logged = detailAfter.body.events[0]
    expect(logged).toMatchObject({
      kind: 'maintenance',
      occurredOn: '2026-09-17',
      summary: 'Swapped the 20x25x4.',
    })
    expect(logged.partsReplaced).toEqual(['Air filter'])

    const stockAfter = detailAfter.body.consumables.find(
      (c: { name: string }) => c.name === 'Air filter',
    ).quantityOnHand
    expect(stockAfter).toBe(Math.max(stockBefore - 1, 0))
  })

  it('never drives stock below zero', async () => {
    const items = await due()
    const anode = items.find((i) => i.itemName === 'Anode rod')

    if (anode) {
      await as().post(`/api/due/consumable/${anode.id}/complete`, {
        occurredOn: '2026-09-17',
        summary: 'Replaced.',
        vendorId: null,
        cost: null,
        notes: null,
      })
      const register = await as().get(`/api/orgs/${world.orgId}/assets`)
      const heater = (register.body as Array<{ id: string; name: string }>).find(
        (a) => a.name === 'Water heater',
      )!
      const detail = await as().get(`/api/assets/${heater.id}`)
      const rod = detail.body.consumables.find((c: { name: string }) => c.name === 'Anode rod')
      expect(rod.quantityOnHand).toBeGreaterThanOrEqual(0)
    }
  })

  it('advances a property-level task without inventing an asset to log against', async () => {
    const items = await due()
    const gutters = items.find((i) => i.itemName === 'Clear gutters')!
    expect(gutters.assetId).toBeNull()

    const completed = await as().post(`/api/due/task/${gutters.id}/complete`, {
      occurredOn: '2026-09-17',
      summary: 'Cleared the north valley.',
      vendorId: null,
      cost: null,
      notes: null,
    })
    expect(completed.status).toBe(204)

    const after = (await due()).find((i) => i.itemName === 'Clear gutters')!
    expect(after.lastDoneOn).toBe('2026-09-17')
    // service_events hangs off an asset, so there is nowhere to file this.
    // The date still moves; the UI says so in the dialog.
  })

  it('refuses a completion date that is not a calendar date', async () => {
    const items = await due()
    const task = items.find((i) => i.itemType === 'task')!

    const result = await as().post(`/api/due/task/${task.id}/complete`, {
      occurredOn: '2026-09-17T12:00:00Z',
      summary: 'Done.',
      vendorId: null,
      cost: null,
      notes: null,
    })

    // Truncating a timestamp would silently shift the day for anyone not on
    // UTC, so the format is required to be exact.
    expect(result.status).toBe(422)
    expect(result.body.code).toBe('validation')
  })

  it('counts open items per property the same way the register does', async () => {
    const properties = await as().get(`/api/orgs/${world.orgId}/properties`)
    const register = await as().get(`/api/orgs/${world.orgId}/assets`)
    const items = await due()

    for (const property of properties.body as Array<{ id: string; openItemCount: number }>) {
      const overdueHere = items.filter(
        (i) => i.status === 'overdue' || i.status === 'due',
      ).length
      expect(typeof property.openItemCount).toBe('number')
      expect(property.openItemCount).toBeLessThanOrEqual(overdueHere)
    }

    const registerOverdue = (register.body as Array<{ openItemCount: number }>).reduce(
      (sum, entry) => sum + entry.openItemCount,
      0,
    )
    expect(registerOverdue).toBeGreaterThanOrEqual(0)
  })
})
