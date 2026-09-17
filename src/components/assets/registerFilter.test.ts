import { describe, expect, it } from 'vitest'
import type { AssetListEntry, WarrantyState } from '@/domain'
import {
  EMPTY_FILTER,
  filterAssets,
  sortAssets,
  summarize,
  type RegisterFilter,
} from './registerFilter'

function entry(overrides: Partial<AssetListEntry> & { id: string }): AssetListEntry {
  return {
    propertyId: 'prop-1',
    propertyName: 'Maple Street',
    name: 'Thing',
    brand: null,
    modelNumber: null,
    serialNumber: null,
    categoryId: null,
    categoryName: null,
    categorySlug: null,
    groupName: null,
    locationName: null,
    status: 'active',
    installDate: null,
    purchaseDate: null,
    expectedLifespanYears: null,
    warranty: { state: 'unknown', daysRemaining: null, warrantyId: null },
    lastServicedOn: null,
    openItemCount: 0,
    documentCount: 0,
    tags: [],
    ...overrides,
  }
}

const withWarranty = (id: string, state: WarrantyState, extra: Partial<AssetListEntry> = {}) =>
  entry({
    id,
    name: id,
    warranty: { state, daysRemaining: state === 'expiring' ? 10 : null, warrantyId: 'w' },
    ...extra,
  })

const FIXTURE: AssetListEntry[] = [
  entry({
    id: 'furnace',
    name: 'Furnace',
    brand: 'Carrier',
    modelNumber: '59TP6',
    serialNumber: '4218A93472',
    categoryId: 'cat-furnace',
    categoryName: 'Furnace',
    groupName: 'HVAC',
    locationName: 'Mechanical room',
    installDate: '2021-09-01',
    lastServicedOn: '2026-02-01',
    warranty: { state: 'expiring', daysRemaining: 37, warrantyId: 'w1' },
    tags: ['gas'],
    openItemCount: 2,
  }),
  entry({
    id: 'heater',
    name: 'Water heater',
    brand: 'Rheem',
    categoryId: 'cat-heater',
    categoryName: 'Water heater',
    groupName: 'Water',
    status: 'needs_repair',
    installDate: '2017-09-01',
    warranty: { state: 'expired', daysRemaining: -120, warrantyId: 'w2' },
    tags: ['replace-soon'],
  }),
  entry({
    id: 'roof',
    name: 'Roof',
    categoryId: 'cat-roof',
    categoryName: 'Roof',
    groupName: 'Exterior',
    propertyId: 'prop-2',
    propertyName: 'Lake cabin',
    installDate: '2019-06-01',
    lastServicedOn: '2025-12-01',
  }),
]

const filter = (overrides: Partial<RegisterFilter>): RegisterFilter => ({
  ...EMPTY_FILTER,
  ...overrides,
})

describe('filterAssets', () => {
  it('returns everything when nothing is set', () => {
    expect(filterAssets(FIXTURE, EMPTY_FILTER)).toHaveLength(3)
  })

  it('searches make, model, serial, room and tags, not just the name', () => {
    expect(filterAssets(FIXTURE, filter({ search: 'carrier' })).map((e) => e.id)).toEqual(['furnace'])
    expect(filterAssets(FIXTURE, filter({ search: '4218a' })).map((e) => e.id)).toEqual(['furnace'])
    expect(filterAssets(FIXTURE, filter({ search: 'mechanical' })).map((e) => e.id)).toEqual(['furnace'])
    expect(filterAssets(FIXTURE, filter({ search: 'replace-soon' })).map((e) => e.id)).toEqual(['heater'])
  })

  it('ignores case and surrounding whitespace', () => {
    expect(filterAssets(FIXTURE, filter({ search: '  RHEEM ' })).map((e) => e.id)).toEqual(['heater'])
  })

  it('narrows by property and category', () => {
    expect(filterAssets(FIXTURE, filter({ propertyId: 'prop-2' })).map((e) => e.id)).toEqual(['roof'])
    expect(filterAssets(FIXTURE, filter({ categoryId: 'cat-heater' })).map((e) => e.id)).toEqual(['heater'])
  })

  it('combines filters rather than widening', () => {
    expect(filterAssets(FIXTURE, filter({ propertyId: 'prop-1', search: 'roof' }))).toHaveLength(0)
  })

  describe('tiles', () => {
    it('separates undocumented cover from lapsed cover', () => {
      expect(filterAssets(FIXTURE, filter({ tile: 'undocumented' })).map((e) => e.id)).toEqual(['roof'])
      expect(filterAssets(FIXTURE, filter({ tile: 'expired' })).map((e) => e.id)).toEqual(['heater'])
    })

    it('finds expiring cover, overdue work and repair flags', () => {
      expect(filterAssets(FIXTURE, filter({ tile: 'expiring' })).map((e) => e.id)).toEqual(['furnace'])
      expect(filterAssets(FIXTURE, filter({ tile: 'overdue' })).map((e) => e.id)).toEqual(['furnace'])
      expect(filterAssets(FIXTURE, filter({ tile: 'needsRepair' })).map((e) => e.id)).toEqual(['heater'])
    })
  })
})

describe('summarize', () => {
  it('counts the whole register, so the tiles keep working as a filter control', () => {
    expect(summarize(FIXTURE)).toEqual({
      total: 3,
      undocumented: 1,
      expiring: 1,
      expired: 1,
      overdue: 1,
      needsRepair: 1,
    })
  })

  it('counts unknown cover in neither the expiring nor the expired tile', () => {
    const undocumented = [withWarranty('a', 'unknown'), withWarranty('b', 'unknown')]
    const summary = summarize(undocumented)
    expect(summary.undocumented).toBe(2)
    expect(summary.expiring).toBe(0)
    expect(summary.expired).toBe(0)
  })

  it('counts lifetime cover as neither expiring nor undocumented', () => {
    const summary = summarize([withWarranty('a', 'lifetime')])
    expect(summary).toMatchObject({ total: 1, undocumented: 0, expiring: 0, expired: 0 })
  })
})

describe('sortAssets', () => {
  it('sorts by name, and flips on a second click', () => {
    expect(sortAssets(FIXTURE, 'name').map((e) => e.name)).toEqual(['Furnace', 'Roof', 'Water heater'])
    expect(sortAssets(FIXTURE, 'name', 'desc').map((e) => e.name)).toEqual([
      'Water heater',
      'Roof',
      'Furnace',
    ])
  })

  it('groups by property, then by name inside it', () => {
    expect(sortAssets(FIXTURE, 'property').map((e) => e.propertyName)).toEqual([
      'Lake cabin',
      'Maple Street',
      'Maple Street',
    ])
  })

  it('orders by warranty with the worst cover first', () => {
    expect(sortAssets(FIXTURE, 'warranty').map((e) => e.warranty.state)).toEqual([
      'expired',
      'expiring',
      'unknown',
    ])
  })

  it('puts assets with no install date last in either direction', () => {
    const withUnknown = [...FIXTURE, entry({ id: 'mystery', name: 'Mystery box' })]
    expect(sortAssets(withUnknown, 'age').at(-1)?.id).toBe('mystery')
    expect(sortAssets(withUnknown, 'age', 'desc').at(-1)?.id).toBe('mystery')
  })

  it('does not mutate the array it was given', () => {
    const original = [...FIXTURE]
    sortAssets(FIXTURE, 'name', 'desc')
    expect(FIXTURE).toEqual(original)
  })
})
