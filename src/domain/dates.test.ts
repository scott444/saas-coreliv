import { describe, expect, it } from 'vitest'
import { addInterval, daysBetween, daysFromToday, describeInterval } from './dates.js'
import { dueStatus } from './maintenance.js'

describe('addInterval', () => {
  it('adds days and weeks', () => {
    expect(addInterval('2026-01-01', 10, 'day')).toBe('2026-01-11')
    expect(addInterval('2026-01-01', 2, 'week')).toBe('2026-01-15')
  })

  it('adds months and years', () => {
    expect(addInterval('2026-01-15', 3, 'month')).toBe('2026-04-15')
    expect(addInterval('2026-01-15', 2, 'year')).toBe('2028-01-15')
  })

  it('clamps to the end of a shorter month rather than spilling into the next', () => {
    // The whole point: "every month" from the 31st must not skip February.
    expect(addInterval('2026-01-31', 1, 'month')).toBe('2026-02-28')
    expect(addInterval('2028-01-31', 1, 'month')).toBe('2028-02-29')
    expect(addInterval('2026-03-31', 1, 'month')).toBe('2026-04-30')
  })

  it('handles 29 February plus a year', () => {
    expect(addInterval('2028-02-29', 1, 'year')).toBe('2029-02-28')
  })

  it('goes backwards with a negative value', () => {
    expect(addInterval('2026-03-15', -1, 'month')).toBe('2026-02-15')
    expect(addInterval('2026-01-01', -1, 'day')).toBe('2025-12-31')
  })

  it('returns null for an unparseable date', () => {
    expect(addInterval('not-a-date', 1, 'month')).toBeNull()
    expect(addInterval('2026-1-1', 1, 'month')).toBeNull()
  })
})

describe('daysBetween', () => {
  it('counts forwards and backwards', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30)
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30)
  })

  it('is unaffected by a DST transition falling between the dates', () => {
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14)
  })

  it('returns null when either side is missing', () => {
    expect(daysBetween('2026-01-01', 'nonsense')).toBeNull()
  })
})

describe('dueStatus', () => {
  const NOW = new Date(2026, 5, 15, 9, 0, 0).getTime()

  it('separates never-done from overdue', () => {
    // A task with no last-done date has nothing to be late against.
    expect(dueStatus(null, NOW)).toBe('unscheduled')
    expect(dueStatus('2026-06-14', NOW)).toBe('overdue')
  })

  it('calls today due, and the next 30 days soon', () => {
    expect(dueStatus('2026-06-15', NOW)).toBe('due')
    expect(dueStatus('2026-07-15', NOW)).toBe('soon')
    expect(dueStatus('2026-07-16', NOW)).toBe('upcoming')
  })
})

describe('describeInterval', () => {
  it('uses the natural word for a single unit', () => {
    expect(describeInterval(1, 'month')).toBe('monthly')
    expect(describeInterval(1, 'year')).toBe('yearly')
  })

  it('spells out anything else', () => {
    expect(describeInterval(3, 'month')).toBe('every 3 months')
    expect(describeInterval(10, 'day')).toBe('every 10 days')
  })
})

describe('daysFromToday', () => {
  it('is null for a missing date', () => {
    expect(daysFromToday(null)).toBeNull()
  })
})
