import type { DateOnly } from './dates.js'
import { daysBetween, todayAsUtcDay, toUtcDay } from './dates.js'
import type { Specs } from './category.js'
import type { WarrantySummary } from './warranty.js'

export type AssetStatus = 'active' | 'needs_repair' | 'retired' | 'replaced'

export const ASSET_STATUSES: readonly AssetStatus[] = [
  'active',
  'needs_repair',
  'retired',
  'replaced',
] as const

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'Active',
  needs_repair: 'Needs repair',
  retired: 'Retired',
  replaced: 'Replaced',
}

/**
 * Anything in the house with a make, model or serial worth writing down:
 * a furnace, a dishwasher, the roof, the paint in the hallway.
 *
 * Category-specific attributes live in `specs` rather than in columns, because
 * the union of everything a furnace and a roof want to record is dozens of
 * fields that are null for almost every row. The category's `specSchema` says
 * which keys belong here and how to render them.
 */
export interface Asset {
  id: string
  propertyId: string
  categoryId: string | null
  locationId: string | null
  /** An AC condenser can hang off the HVAC system it belongs to. */
  parentAssetId: string | null

  name: string
  brand: string | null
  modelNumber: string | null
  serialNumber: string | null
  description: string | null

  purchaseDate: DateOnly | null
  installDate: DateOnly | null
  /** Often decoded from the serial rather than known outright. */
  manufactureDate: DateOnly | null
  purchaseCost: number | null
  installCost: number | null
  retailerId: string | null
  installerId: string | null

  expectedLifespanYears: number | null
  status: AssetStatus
  replacedById: string | null
  retiredAt: DateOnly | null

  specs: Specs
  notes: string | null
  tags: string[]

  createdAt: string
  updatedAt: string
}

export type AssetInput = Omit<Asset, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>

/**
 * A row in the register: the asset plus the labels and derived state a list
 * needs, joined server-side. Assembling this client-side would have meant a
 * query per property plus a query per asset.
 */
export interface AssetListEntry {
  id: string
  propertyId: string
  propertyName: string
  name: string
  brand: string | null
  modelNumber: string | null
  serialNumber: string | null
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  groupName: string | null
  locationName: string | null
  status: AssetStatus
  installDate: DateOnly | null
  purchaseDate: DateOnly | null
  expectedLifespanYears: number | null
  warranty: WarrantySummary
  lastServicedOn: DateOnly | null
  openItemCount: number
  documentCount: number
  tags: string[]
}

/** Age vs expected lifespan, plus what it has cost so far. */
export interface ReplacementPlan {
  inServiceDate: DateOnly | null
  ageYears: number | null
  expectedLifespanYears: number | null
  projectedReplacement: DateOnly | null
  acquisitionCost: number
  lifetimeServiceCost: number
}

export type LifecycleState = 'unknown' | 'healthy' | 'aging' | 'due' | 'overdue'

/** How close the asset is to the end of its expected life. */
export function lifecycleState(
  plan: Pick<ReplacementPlan, 'projectedReplacement'>,
  now: number = Date.now(),
): LifecycleState {
  const target = toUtcDay(plan.projectedReplacement)
  if (target === null) return 'unknown'
  const days = daysBetween(todayAsUtcDay(now), target)
  if (days === null) return 'unknown'
  if (days < 0) return 'overdue'
  if (days <= 365) return 'due'
  if (days <= 365 * 3) return 'aging'
  return 'healthy'
}

export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  unknown: 'No lifespan recorded',
  healthy: 'Well within life',
  aging: 'Approaching end of life',
  due: 'Due for replacement',
  overdue: 'Past expected life',
}

/**
 * Whole months an asset has been in service.
 *
 * Counts by calendar month rather than dividing a day count, so a unit
 * installed on the 31st is not a month older than one installed on the 1st.
 */
export function monthsInService(
  installDate: DateOnly | null | undefined,
  now: number = Date.now(),
): number | null {
  const day = toUtcDay(installDate)
  if (day === null) return null
  const start = new Date(day)
  const today = new Date(todayAsUtcDay(now))
  if (start.getTime() > today.getTime()) return null

  let months =
    (today.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - start.getUTCMonth())
  if (today.getUTCDate() < start.getUTCDate()) months -= 1
  return Math.max(0, months)
}

/** "4 yr 2 mo", "7 mo", "New". */
export function formatServiceAge(months: number | null): string {
  if (months === null) return '—'
  if (months === 0) return 'New'
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} mo`
  if (rest === 0) return `${years} yr`
  return `${years} yr ${rest} mo`
}

/** The date an asset entered service, by the best evidence available. */
export function inServiceDate(
  asset: Pick<Asset, 'installDate' | 'purchaseDate' | 'manufactureDate'>,
): DateOnly | null {
  return asset.installDate ?? asset.purchaseDate ?? asset.manufactureDate ?? null
}
