import type { HardwareRegisterEntry } from '@/domain'
import { warrantySummary } from '@/domain'

/** Which slice of the register is on screen. */
export type RegisterFocus = 'all' | 'missing' | 'expiring' | 'expired'

export const ALL_HOMES = 'all'

export interface RegisterFilters {
  /** Free text; matched case-insensitively and untrimmed input is fine. */
  query: string
  /** A home id, or ALL_HOMES. */
  homeId: string
  focus: RegisterFocus
}

function matchesQuery(entry: HardwareRegisterEntry, needle: string): boolean {
  if (needle === '') return true
  // The fields someone would actually search a register by.
  return [
    entry.system.name,
    entry.homeName,
    entry.hardware?.manufacturer,
    entry.hardware?.model,
    entry.hardware?.serialNumber,
  ].some((value) => value?.toLowerCase().includes(needle))
}

function matchesFocus(entry: HardwareRegisterEntry, focus: RegisterFocus, now?: number): boolean {
  switch (focus) {
    case 'all':
      return true
    case 'missing':
      return entry.hardware === null
    case 'expiring':
      return warrantySummary(entry.hardware, now).state === 'expiring'
    case 'expired':
      return warrantySummary(entry.hardware, now).state === 'expired'
  }
}

/** Filtered and ordered for display: grouped by home, then by device name. */
export function filterRegister(
  entries: HardwareRegisterEntry[],
  filters: RegisterFilters,
  now?: number,
): HardwareRegisterEntry[] {
  const needle = filters.query.trim().toLowerCase()
  return entries
    .filter((entry) => (filters.homeId === ALL_HOMES ? true : entry.homeId === filters.homeId))
    .filter((entry) => matchesFocus(entry, filters.focus, now))
    .filter((entry) => matchesQuery(entry, needle))
    .sort((a, b) => a.homeName.localeCompare(b.homeName) || a.system.name.localeCompare(b.system.name))
}

/** The distinct homes present in the register, for the home filter. */
export function registerHomes(entries: HardwareRegisterEntry[]): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>()
  for (const entry of entries) byId.set(entry.homeId, entry.homeName)
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}
