import type { DateOnly } from './dates.js'
import { daysFromToday } from './dates.js'

export type WarrantyKind =
  | 'manufacturer_parts'
  | 'manufacturer_labor'
  | 'installer_labor'
  | 'extended'
  | 'home_warranty'

export const WARRANTY_KINDS: readonly WarrantyKind[] = [
  'manufacturer_parts',
  'manufacturer_labor',
  'installer_labor',
  'extended',
  'home_warranty',
] as const

export const WARRANTY_KIND_LABELS: Record<WarrantyKind, string> = {
  manufacturer_parts: 'Manufacturer — parts',
  manufacturer_labor: 'Manufacturer — labor',
  installer_labor: 'Installer labor',
  extended: 'Extended',
  home_warranty: 'Home warranty',
}

export interface Warranty {
  id: string
  assetId: string
  kind: WarrantyKind
  providerId: string | null
  providerName: string | null
  startDate: DateOnly
  /** Null means lifetime cover, which is not the same as unknown. */
  endDate: DateOnly | null
  registered: boolean
  registrationRef: string | null
  transferable: boolean | null
  coverageNotes: string | null
  claimPhone: string | null
}

export type WarrantyInput = Omit<Warranty, 'id' | 'assetId' | 'providerName'>

/**
 * `unknown` is deliberately distinct from `expired`: an asset with no warranty
 * recorded has undocumented cover, which is a gap in the record rather than a
 * lapse in cover, and the two want different follow-up.
 */
export type WarrantyState = 'unknown' | 'active' | 'expiring' | 'expired' | 'lifetime'

/** How close to expiry counts as "renew this soon". */
export const WARRANTY_EXPIRING_DAYS = 60

export interface WarrantySummary {
  state: WarrantyState
  /** Null for lifetime or unknown cover. Negative once expired. */
  daysRemaining: number | null
  /** The warranty this summary describes, when there is one. */
  warrantyId: string | null
}

export const UNKNOWN_WARRANTY: WarrantySummary = {
  state: 'unknown',
  daysRemaining: null,
  warrantyId: null,
}

/** Where a single warranty stands today. */
export function warrantySummary(
  warranty: Pick<Warranty, 'id' | 'endDate'>,
  now: number = Date.now(),
): WarrantySummary {
  if (warranty.endDate === null) {
    return { state: 'lifetime', daysRemaining: null, warrantyId: warranty.id }
  }
  const daysRemaining = daysFromToday(warranty.endDate, now)
  if (daysRemaining === null) return { ...UNKNOWN_WARRANTY, warrantyId: warranty.id }
  const state: WarrantyState =
    daysRemaining < 0 ? 'expired' : daysRemaining <= WARRANTY_EXPIRING_DAYS ? 'expiring' : 'active'
  return { state, daysRemaining, warrantyId: warranty.id }
}

/**
 * The best cover an asset still has, for a one-line summary in a list.
 *
 * "Best" is the longest-running live warranty: lifetime beats a date, a later
 * date beats an earlier one, and only when nothing is live does the most
 * recently expired one stand in - so the badge answers "am I covered?" first
 * and "when did that stop?" second.
 */
export function bestWarranty(
  warranties: ReadonlyArray<Pick<Warranty, 'id' | 'endDate'>>,
  now: number = Date.now(),
): WarrantySummary {
  if (warranties.length === 0) return UNKNOWN_WARRANTY

  const summaries = warranties.map((w) => warrantySummary(w, now))
  const lifetime = summaries.find((s) => s.state === 'lifetime')
  if (lifetime) return lifetime

  const live = summaries.filter((s) => s.daysRemaining !== null && s.daysRemaining >= 0)
  if (live.length > 0) {
    return live.reduce((best, s) => (s.daysRemaining! > best.daysRemaining! ? s : best))
  }

  const expired = summaries.filter((s) => s.daysRemaining !== null)
  if (expired.length === 0) return UNKNOWN_WARRANTY
  return expired.reduce((latest, s) => (s.daysRemaining! > latest.daysRemaining! ? s : latest))
}

export const WARRANTY_STATE_LABELS: Record<WarrantyState, string> = {
  unknown: 'Not recorded',
  active: 'In warranty',
  expiring: 'Expiring soon',
  expired: 'Out of warranty',
  lifetime: 'Lifetime',
}
