import type { HomeSystem } from './system'

/**
 * The physical device behind a HomeSystem: who made it, when it went in, and
 * what you would need to quote at a warranty desk.
 *
 * Kept separate from `HomeSystem` because the two change on completely
 * different clocks - `HomeSystem.status` is live telemetry polled every few
 * seconds, this is an asset record that changes when an engineer visits.
 */
export interface SystemHardware {
  systemId: string
  manufacturer: string
  model: string
  /** May be empty: not every device exposes a readable serial. */
  serialNumber: string
  /** Calendar date, "YYYY-MM-DD". Null when it was never recorded. */
  installedAt: string | null
  /** Calendar date, "YYYY-MM-DD". Null when unknown or out of warranty cover. */
  warrantyExpiresAt: string | null
  firmwareVersion: string | null
  installer: string | null
  notes: string | null
}

export type SystemHardwareInput = Omit<SystemHardware, 'systemId'>

export type WarrantyState = 'unknown' | 'active' | 'expiring' | 'expired'

/** How close to expiry counts as "renew this soon". */
export const WARRANTY_EXPIRING_DAYS = 60

export interface WarrantySummary {
  state: WarrantyState
  /** Null when no expiry date is recorded. Negative once expired. */
  daysRemaining: number | null
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

/**
 * A "YYYY-MM-DD" string as a UTC-midnight timestamp.
 *
 * Calendar dates are compared as UTC days rather than local Date objects so
 * that day arithmetic cannot be skewed by a DST boundary falling between the
 * two dates.
 */
function toUtcDay(value: string | null | undefined): number | null {
  if (!value) return null
  const match = DATE_ONLY.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(ms) ? null : ms
}

/** The local calendar day of `now`, as the same kind of UTC-midnight timestamp. */
function todayAsUtcDay(now: number): number {
  const d = new Date(now)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

export function warrantySummary(
  hardware: Pick<SystemHardware, 'warrantyExpiresAt'> | null | undefined,
  now: number = Date.now(),
): WarrantySummary {
  const expiry = toUtcDay(hardware?.warrantyExpiresAt)
  if (expiry === null) return { state: 'unknown', daysRemaining: null }

  const daysRemaining = Math.round((expiry - todayAsUtcDay(now)) / MS_PER_DAY)
  if (daysRemaining < 0) return { state: 'expired', daysRemaining }
  if (daysRemaining <= WARRANTY_EXPIRING_DAYS) return { state: 'expiring', daysRemaining }
  return { state: 'active', daysRemaining }
}

/**
 * Whole months since installation, or null when there is no install date - or
 * when it is in the future, which happens for a planned swap and has no
 * meaningful "age" to show.
 */
export function monthsInService(
  hardware: Pick<SystemHardware, 'installedAt'> | null | undefined,
  now: number = Date.now(),
): number | null {
  const installed = toUtcDay(hardware?.installedAt)
  if (installed === null) return null

  const today = new Date(todayAsUtcDay(now))
  const start = new Date(installed)
  if (installed > today.getTime()) return null

  let months = (today.getUTCFullYear() - start.getUTCFullYear()) * 12 + (today.getUTCMonth() - start.getUTCMonth())
  // Not a full month yet if the day-of-month has not come round again.
  if (today.getUTCDate() < start.getUTCDate()) months -= 1
  return Math.max(0, months)
}

// ---------- Register (cross-home read model) ----------

/**
 * One row of the hardware register: a system, where it lives, and its record.
 *
 * A flattened read model rather than something the client joins together - the
 * register spans every home in the org, so assembling it client-side would mean
 * a query per home plus a query per system. `hardware` is null for a system
 * nobody has documented yet, which the register exists to surface.
 */
export interface HardwareRegisterEntry {
  system: HomeSystem
  homeId: string
  homeName: string
  hardware: SystemHardware | null
}

export interface RegisterSummary {
  total: number
  documented: number
  missing: number
  expiringSoon: number
  expired: number
}

export function summarizeRegister(entries: HardwareRegisterEntry[], now: number = Date.now()): RegisterSummary {
  const summary: RegisterSummary = { total: entries.length, documented: 0, missing: 0, expiringSoon: 0, expired: 0 }

  for (const entry of entries) {
    if (!entry.hardware) {
      summary.missing += 1
      continue
    }
    summary.documented += 1
    // A device with no warranty date recorded is not counted either way: we
    // know nothing about its cover, which is different from knowing it lapsed.
    const { state } = warrantySummary(entry.hardware, now)
    if (state === 'expiring') summary.expiringSoon += 1
    if (state === 'expired') summary.expired += 1
  }

  return summary
}
