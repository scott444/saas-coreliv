import type { DateOnly, RecurrenceUnit } from './dates.js'
import { daysFromToday } from './dates.js'

/** Something you do or hire out on a schedule. */
export interface MaintenanceTask {
  id: string
  propertyId: string
  propertyName: string
  /** Null for property-level work like clearing the gutters. */
  assetId: string | null
  assetName: string | null
  name: string
  intervalValue: number
  intervalUnit: RecurrenceUnit
  /** Pin to a month, e.g. 10 for an irrigation blowout. */
  seasonMonth: number | null
  diy: boolean
  preferredVendorId: string | null
  preferredVendorName: string | null
  lastDoneOn: DateOnly | null
  instructions: string | null
  active: boolean
}

export type MaintenanceTaskInput = Omit<
  MaintenanceTask,
  'id' | 'propertyId' | 'propertyName' | 'assetName' | 'preferredVendorName'
>

export type DueItemType = 'task' | 'consumable'

/**
 * `unscheduled` is its own state rather than a flavour of overdue: a task
 * that has never been done has no due date to be late against, and telling
 * someone their brand-new filter is overdue on day one trains them to ignore
 * the list.
 */
export type DueStatus = 'unscheduled' | 'upcoming' | 'soon' | 'due' | 'overdue'

/** Inside this window, an item is worth showing on the dashboard. */
export const DUE_SOON_DAYS = 30

export interface DueItem {
  itemType: DueItemType
  id: string
  propertyId: string
  propertyName: string
  assetId: string | null
  assetName: string | null
  itemName: string
  /** Null when the item has never been done, so nothing can be projected. */
  dueOn: DateOnly | null
  lastDoneOn: DateOnly | null
  intervalValue: number | null
  intervalUnit: RecurrenceUnit | null
  diy: boolean
  status: DueStatus
  daysUntilDue: number | null
}

export function dueStatus(dueOn: DateOnly | null, now: number = Date.now()): DueStatus {
  const days = daysFromToday(dueOn, now)
  if (days === null) return 'unscheduled'
  if (days < 0) return 'overdue'
  if (days === 0) return 'due'
  if (days <= DUE_SOON_DAYS) return 'soon'
  return 'upcoming'
}

export const DUE_STATUS_LABELS: Record<DueStatus, string> = {
  unscheduled: 'Never done',
  upcoming: 'Scheduled',
  soon: 'Due soon',
  due: 'Due today',
  overdue: 'Overdue',
}

/** What gets written to the service log when a due item is marked done. */
export interface CompleteDueInput {
  occurredOn: DateOnly
  summary: string
  vendorId: string | null
  cost: number | null
  notes: string | null
}
