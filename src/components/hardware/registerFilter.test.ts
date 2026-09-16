import { describe, expect, it } from 'vitest'
import type { HardwareRegisterEntry } from '@/domain'
import { ALL_HOMES, filterRegister, registerHomes } from './registerFilter'

/** Fixed "now": 2026-09-16, local noon so the local calendar day is unambiguous. */
const NOW = new Date(2026, 8, 16, 12, 0, 0).getTime()

interface EntrySpec {
  id: string
  name: string
  homeId: string
  homeName: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  warrantyExpiresAt?: string | null
}

function entry(spec: EntrySpec): HardwareRegisterEntry {
  return {
    system: { id: spec.id, homeId: spec.homeId, type: 'Heating', name: spec.name, status: 'Online' },
    homeId: spec.homeId,
    homeName: spec.homeName,
    hardware: spec.manufacturer
      ? {
          systemId: spec.id,
          manufacturer: spec.manufacturer,
          model: spec.model ?? 'M1',
          serialNumber: spec.serialNumber ?? '',
          installedAt: null,
          warrantyExpiresAt: spec.warrantyExpiresAt ?? null,
          firmwareVersion: null,
          installer: null,
          notes: null,
        }
      : null,
  }
}

const ENTRIES: HardwareRegisterEntry[] = [
  entry({ id: 's1', name: 'Sauna heater', homeId: 'h-lake', homeName: 'Lake House', manufacturer: 'Harvia', model: 'PC90E', serialNumber: 'HV-118204', warrantyExpiresAt: '2025-01-01' }),
  entry({ id: 's2', name: 'Heat pump', homeId: 'h-lake', homeName: 'Lake House', manufacturer: 'Nibe', model: 'F1255', serialNumber: 'NB-448713', warrantyExpiresAt: '2028-01-01' }),
  entry({ id: 's3', name: 'Radiators', homeId: 'h-city', homeName: 'City Apartment', manufacturer: 'Danfoss', model: 'Ally', serialNumber: 'DF-553102', warrantyExpiresAt: '2026-10-10' }),
  entry({ id: 's4', name: 'Tumble dryer', homeId: 'h-city', homeName: 'City Apartment' }),
]

const ALL = { query: '', homeId: ALL_HOMES, focus: 'all' } as const
const names = (entries: HardwareRegisterEntry[]) => entries.map((e) => e.system.name)

describe('filterRegister', () => {
  it('returns everything, grouped by home then device name', () => {
    expect(names(filterRegister(ENTRIES, ALL, NOW))).toEqual(['Radiators', 'Tumble dryer', 'Heat pump', 'Sauna heater'])
  })

  it('filters to one home', () => {
    expect(names(filterRegister(ENTRIES, { ...ALL, homeId: 'h-city' }, NOW))).toEqual(['Radiators', 'Tumble dryer'])
  })

  it('matches the query against name, manufacturer, model and serial', () => {
    expect(names(filterRegister(ENTRIES, { ...ALL, query: 'sauna' }, NOW))).toEqual(['Sauna heater'])
    expect(names(filterRegister(ENTRIES, { ...ALL, query: 'nibe' }, NOW))).toEqual(['Heat pump'])
    expect(names(filterRegister(ENTRIES, { ...ALL, query: 'F1255' }, NOW))).toEqual(['Heat pump'])
    expect(names(filterRegister(ENTRIES, { ...ALL, query: 'DF-553102' }, NOW))).toEqual(['Radiators'])
  })

  it('ignores case and surrounding whitespace in the query', () => {
    expect(names(filterRegister(ENTRIES, { ...ALL, query: '  HARVIA  ' }, NOW))).toEqual(['Sauna heater'])
  })

  it('matches on home name too', () => {
    expect(names(filterRegister(ENTRIES, { ...ALL, query: 'lake' }, NOW))).toEqual(['Heat pump', 'Sauna heater'])
  })

  it('focuses on systems with no record', () => {
    expect(names(filterRegister(ENTRIES, { ...ALL, focus: 'missing' }, NOW))).toEqual(['Tumble dryer'])
  })

  it('focuses on expiring and expired warranties separately', () => {
    expect(names(filterRegister(ENTRIES, { ...ALL, focus: 'expiring' }, NOW))).toEqual(['Radiators'])
    expect(names(filterRegister(ENTRIES, { ...ALL, focus: 'expired' }, NOW))).toEqual(['Sauna heater'])
  })

  it('combines home, focus and query', () => {
    expect(names(filterRegister(ENTRIES, { query: 'lake', homeId: 'h-lake', focus: 'expired' }, NOW))).toEqual(['Sauna heater'])
    // A query that contradicts the home filter yields nothing rather than ignoring one.
    expect(filterRegister(ENTRIES, { query: 'danfoss', homeId: 'h-lake', focus: 'all' }, NOW)).toEqual([])
  })

  it('does not mutate the input order', () => {
    const before = names(ENTRIES)
    filterRegister(ENTRIES, ALL, NOW)
    expect(names(ENTRIES)).toEqual(before)
  })
})

describe('registerHomes', () => {
  it('lists each home once, alphabetically', () => {
    expect(registerHomes(ENTRIES)).toEqual([
      { id: 'h-city', name: 'City Apartment' },
      { id: 'h-lake', name: 'Lake House' },
    ])
  })

  it('is empty for an empty register', () => {
    expect(registerHomes([])).toEqual([])
  })
})
