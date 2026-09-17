import type { AssetListEntry } from '@/domain'

/**
 * Filtering and sorting for the register, as pure functions.
 *
 * The whole register is one request, so this runs against the cached list
 * rather than a round trip per keystroke. Keeping it out of the component
 * means it is unit-tested directly - driving a Radix select in jsdom costs
 * about fourteen seconds a case, which is not worth paying in the suite.
 */

export type RegisterTile =
  | 'undocumented'
  | 'expiring'
  | 'expired'
  | 'overdue'
  | 'needsRepair'

export interface RegisterFilter {
  search: string
  propertyId: string | null
  categoryId: string | null
  tile: RegisterTile | null
}

export const EMPTY_FILTER: RegisterFilter = {
  search: '',
  propertyId: null,
  categoryId: null,
  tile: null,
}

export interface RegisterSummary {
  total: number
  undocumented: number
  expiring: number
  expired: number
  overdue: number
  needsRepair: number
}

/** Does this entry belong under the given tile? One definition, used twice. */
function matchesTile(entry: AssetListEntry, tile: RegisterTile): boolean {
  switch (tile) {
    case 'undocumented':
      return entry.warranty.state === 'unknown'
    case 'expiring':
      return entry.warranty.state === 'expiring'
    case 'expired':
      return entry.warranty.state === 'expired'
    case 'overdue':
      return entry.openItemCount > 0
    case 'needsRepair':
      return entry.status === 'needs_repair'
  }
}

function haystack(entry: AssetListEntry): string {
  return [
    entry.name,
    entry.brand,
    entry.modelNumber,
    entry.serialNumber,
    entry.categoryName,
    entry.groupName,
    entry.locationName,
    entry.propertyName,
    ...entry.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function filterAssets(
  entries: readonly AssetListEntry[],
  filter: RegisterFilter,
): AssetListEntry[] {
  const search = filter.search.trim().toLowerCase()

  return entries.filter((entry) => {
    if (filter.propertyId && entry.propertyId !== filter.propertyId) return false
    if (filter.categoryId && entry.categoryId !== filter.categoryId) return false
    if (filter.tile && !matchesTile(entry, filter.tile)) return false
    if (search && !haystack(entry).includes(search)) return false
    return true
  })
}

/**
 * Counts describe the whole register, not the filtered view.
 *
 * The tiles *are* the filter control, so they have to keep showing what there
 * is to filter to - a tile that read zero because it was already applied
 * would be a dead end.
 */
export function summarize(entries: readonly AssetListEntry[]): RegisterSummary {
  return {
    total: entries.length,
    undocumented: entries.filter((e) => matchesTile(e, 'undocumented')).length,
    expiring: entries.filter((e) => matchesTile(e, 'expiring')).length,
    expired: entries.filter((e) => matchesTile(e, 'expired')).length,
    overdue: entries.filter((e) => matchesTile(e, 'overdue')).length,
    needsRepair: entries.filter((e) => matchesTile(e, 'needsRepair')).length,
  }
}

export type SortKey = 'name' | 'property' | 'category' | 'age' | 'warranty' | 'serviced'

/** Where each warranty state sits when sorting by cover: worst first. */
const WARRANTY_ORDER: Record<string, number> = {
  expired: 0,
  expiring: 1,
  unknown: 2,
  active: 3,
  lifetime: 4,
}

export function sortAssets(
  entries: readonly AssetListEntry[],
  key: SortKey,
  direction: 'asc' | 'desc' = 'asc',
): AssetListEntry[] {
  const sign = direction === 'asc' ? 1 : -1
  const byName = (a: AssetListEntry, b: AssetListEntry) => a.name.localeCompare(b.name)

  const sorted = [...entries].sort((a, b) => {
    switch (key) {
      case 'name':
        return byName(a, b)
      case 'property':
        return a.propertyName.localeCompare(b.propertyName) || byName(a, b)
      case 'category':
        return (a.categoryName ?? '').localeCompare(b.categoryName ?? '') || byName(a, b)
      case 'age':
        // Nulls last in either direction: "no install date recorded" is not
        // an age, so it should not win either end of the sort.
        return compareNullableText(a.installDate, b.installDate, sign) || byName(a, b)
      case 'serviced':
        return compareNullableText(a.lastServicedOn, b.lastServicedOn, sign) || byName(a, b)
      case 'warranty':
        return (
          (WARRANTY_ORDER[a.warranty.state] ?? 9) - (WARRANTY_ORDER[b.warranty.state] ?? 9) ||
          byName(a, b)
        )
    }
  })

  // The nullable and enum comparators above already encode their own order,
  // so only the plain text keys get flipped here.
  return direction === 'desc' && key !== 'age' && key !== 'serviced' ? sorted.reverse() : sorted
}

function compareNullableText(a: string | null, b: string | null, sign: number): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b) * sign
}
