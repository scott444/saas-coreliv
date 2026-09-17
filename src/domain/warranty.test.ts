import { describe, expect, it } from 'vitest'
import { bestWarranty, warrantySummary, WARRANTY_EXPIRING_DAYS } from './warranty.js'
import { monthsInService } from './asset.js'

/** 15 June 2026, midday local - far from any boundary unless a test asks for one. */
const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime()

const w = (id: string, endDate: string | null) => ({ id, endDate })

describe('warrantySummary', () => {
  it('reports a live warranty with the days left', () => {
    expect(warrantySummary(w('a', '2026-12-31'), NOW)).toEqual({
      state: 'active',
      daysRemaining: 199,
      warrantyId: 'a',
    })
  })

  it('treats a null end date as lifetime, not as unknown', () => {
    expect(warrantySummary(w('a', null), NOW)).toEqual({
      state: 'lifetime',
      daysRemaining: null,
      warrantyId: 'a',
    })
  })

  it('flags the last WARRANTY_EXPIRING_DAYS as expiring, inclusive of the boundary', () => {
    const boundary = '2026-08-14' // exactly 60 days out
    expect(warrantySummary(w('a', boundary), NOW).state).toBe('expiring')
    expect(warrantySummary(w('a', boundary), NOW).daysRemaining).toBe(WARRANTY_EXPIRING_DAYS)

    // One day further out is still comfortably active.
    expect(warrantySummary(w('a', '2026-08-15'), NOW).state).toBe('active')
  })

  it('counts the last day of cover as still covered', () => {
    expect(warrantySummary(w('a', '2026-06-15'), NOW)).toMatchObject({
      state: 'expiring',
      daysRemaining: 0,
    })
  })

  it('reports an expired warranty with a negative day count', () => {
    expect(warrantySummary(w('a', '2026-06-14'), NOW)).toMatchObject({
      state: 'expired',
      daysRemaining: -1,
    })
  })

  it('is not skewed by a DST boundary between the two dates', () => {
    // 8 March 2026 is a US DST transition. Counting in local time would make
    // this 89.958 days and round the wrong way; UTC day numbers do not.
    const beforeDst = new Date(2026, 1, 1, 12, 0, 0).getTime() // 1 Feb
    expect(warrantySummary(w('a', '2026-05-02'), beforeDst).daysRemaining).toBe(90)
  })
})

describe('bestWarranty', () => {
  it('is unknown when nothing is recorded — which is not the same as expired', () => {
    expect(bestWarranty([], NOW)).toEqual({
      state: 'unknown',
      daysRemaining: null,
      warrantyId: null,
    })
  })

  it('prefers lifetime cover over any dated warranty', () => {
    const summary = bestWarranty([w('dated', '2030-01-01'), w('forever', null)], NOW)
    expect(summary.state).toBe('lifetime')
    expect(summary.warrantyId).toBe('forever')
  })

  it('picks the longest-running live warranty', () => {
    const summary = bestWarranty(
      [w('short', '2026-07-01'), w('long', '2029-01-01'), w('gone', '2020-01-01')],
      NOW,
    )
    expect(summary.warrantyId).toBe('long')
    expect(summary.state).toBe('active')
  })

  it('falls back to the most recently expired one when nothing is live', () => {
    const summary = bestWarranty([w('older', '2019-01-01'), w('newer', '2025-01-01')], NOW)
    expect(summary.warrantyId).toBe('newer')
    expect(summary.state).toBe('expired')
  })
})

describe('monthsInService', () => {
  it('counts whole calendar months', () => {
    expect(monthsInService('2024-06-15', NOW)).toBe(24)
    expect(monthsInService('2026-03-15', NOW)).toBe(3)
  })

  it('does not credit a month until the day of the month comes round', () => {
    expect(monthsInService('2026-05-16', NOW)).toBe(0)
    expect(monthsInService('2026-05-15', NOW)).toBe(1)
  })

  it('returns null for a missing or future date rather than a negative age', () => {
    expect(monthsInService(null, NOW)).toBeNull()
    expect(monthsInService('2027-01-01', NOW)).toBeNull()
  })
})
