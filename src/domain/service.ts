import type { DateOnly } from './dates.js'

export type ServiceKind =
  | 'install'
  | 'maintenance'
  | 'repair'
  | 'inspection'
  | 'replacement'
  | 'recall'
  | 'other'

export const SERVICE_KINDS: readonly ServiceKind[] = [
  'install',
  'maintenance',
  'repair',
  'inspection',
  'replacement',
  'recall',
  'other',
] as const

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  install: 'Install',
  maintenance: 'Maintenance',
  repair: 'Repair',
  inspection: 'Inspection',
  replacement: 'Replacement',
  recall: 'Recall',
  other: 'Other',
}

/** Append-only log of everything that has happened to an asset. */
export interface ServiceEvent {
  id: string
  assetId: string
  assetName: string
  propertyId: string
  /** Set when the visit satisfied a scheduled task or a consumable swap. */
  taskId: string | null
  consumableId: string | null
  kind: ServiceKind
  occurredOn: DateOnly
  vendorId: string | null
  vendorName: string | null
  technician: string | null
  cost: number | null
  coveredByWarrantyId: string | null
  summary: string
  partsReplaced: string[]
  /** Free-form measurements: {"static_pressure": 0.6, "refrigerant_added_oz": 8} */
  readings: Record<string, number | string> | null
  createdAt: string
}

export type ServiceEventInput = Omit<
  ServiceEvent,
  'id' | 'assetId' | 'assetName' | 'propertyId' | 'vendorName' | 'createdAt'
>
