import { describe, expect, it } from 'vitest'
import type { HardwareRegisterEntry } from './hardware'
import { WARRANTY_EXPIRING_DAYS, monthsInService, summarizeRegister, warrantySummary } from './hardware'

/** Fixed "now": 2026-09-16, local noon so the local calendar day is unambiguous. */
const NOW = new Date(2026, 8, 16, 12, 0, 0).getTime()

describe('warrantySummary', () => {
  it('is unknown when no expiry date is recorded', () => {
    expect(warrantySummary({ warrantyExpiresAt: null }, NOW)).toEqual({ state: 'unknown', daysRemaining: null })
    expect(warrantySummary(null, NOW).state).toBe('unknown')
  })

  it('is active well before expiry', () => {
    expect(warrantySummary({ warrantyExpiresAt: '2027-09-16' }, NOW)).toEqual({ state: 'active', daysRemaining: 365 })
  })

  it('is expiring inside the warning window, inclusive of both ends', () => {
    expect(warrantySummary({ warrantyExpiresAt: '2026-11-15' }, NOW)).toEqual({
      state: 'expiring',
      daysRemaining: WARRANTY_EXPIRING_DAYS,
    })
    // Expiring today still counts as cover, not a lapse.
    expect(warrantySummary({ warrantyExpiresAt: '2026-09-16' }, NOW)).toEqual({ state: 'expiring', daysRemaining: 0 })
  })

  it('is active one day past the warning window', () => {
    expect(warrantySummary({ warrantyExpiresAt: '2026-11-16' }, NOW).state).toBe('active')
  })

  it('is expired the day after the end date', () => {
    expect(warrantySummary({ warrantyExpiresAt: '2026-09-15' }, NOW)).toEqual({ state: 'expired', daysRemaining: -1 })
  })

  it('treats an unparseable date as unknown rather than throwing', () => {
    expect(warrantySummary({ warrantyExpiresAt: 'someday' }, NOW).state).toBe('unknown')
  })

  it('counts whole days across a DST boundary', () => {
    // EU clocks go back on 2026-10-25; a naive local-midnight diff would give
    // 39.04 days here and round to the wrong day count.
    const midOctober = new Date(2026, 9, 20, 12, 0, 0).getTime()
    expect(warrantySummary({ warrantyExpiresAt: '2026-11-28' }, midOctober).daysRemaining).toBe(39)
  })
})

describe('monthsInService', () => {
  it('is null when no install date is recorded', () => {
    expect(monthsInService({ installedAt: null }, NOW)).toBeNull()
  })

  it('counts whole months only', () => {
    expect(monthsInService({ installedAt: '2026-08-16' }, NOW)).toBe(1)
    // One day short of a month.
    expect(monthsInService({ installedAt: '2026-08-17' }, NOW)).toBe(0)
    expect(monthsInService({ installedAt: '2021-09-14' }, NOW)).toBe(60)
  })

  it('is null for a future install date, which has no age to report', () => {
    expect(monthsInService({ installedAt: '2027-01-01' }, NOW)).toBeNull()
  })
})

describe('summarizeRegister', () => {
  const system = (id: string): HardwareRegisterEntry['system'] => ({
    id,
    homeId: 'h1',
    type: 'Heating',
    name: id,
    status: 'Online',
  })

  const entry = (id: string, warrantyExpiresAt: string | null | undefined): HardwareRegisterEntry => ({
    system: system(id),
    homeId: 'h1',
    homeName: 'Home',
    hardware:
      warrantyExpiresAt === undefined
        ? null
        : {
            systemId: id,
            manufacturer: 'Acme',
            model: 'M1',
            serialNumber: '',
            installedAt: null,
            warrantyExpiresAt,
            firmwareVersion: null,
            installer: null,
            notes: null,
          },
  })

  it('counts an empty register as all zeroes', () => {
    expect(summarizeRegister([], NOW)).toEqual({ total: 0, documented: 0, missing: 0, expiringSoon: 0, expired: 0 })
  })

  it('splits documented from undocumented systems', () => {
    const summary = summarizeRegister([entry('a', '2027-09-16'), entry('b', undefined), entry('c', undefined)], NOW)
    expect(summary).toMatchObject({ total: 3, documented: 1, missing: 2 })
  })

  it('counts each warranty state once', () => {
    const summary = summarizeRegister(
      [entry('a', '2027-09-16'), entry('b', '2026-10-01'), entry('c', '2025-01-01'), entry('d', '2024-06-30')],
      NOW,
    )
    expect(summary).toMatchObject({ total: 4, documented: 4, missing: 0, expiringSoon: 1, expired: 2 })
  })

  it('leaves a documented device with no warranty date out of both warranty counts', () => {
    // Unknown cover is not the same as lapsed cover.
    const summary = summarizeRegister([entry('a', null)], NOW)
    expect(summary).toEqual({ total: 1, documented: 1, missing: 0, expiringSoon: 0, expired: 0 })
  })
})
