import type { DateOnly } from './dates.js'

export type DocumentKind =
  | 'receipt'
  | 'manual'
  | 'data_plate_photo'
  | 'photo'
  | 'warranty'
  | 'permit'
  | 'invoice'
  | 'inspection_report'
  | 'other'

export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  'receipt',
  'manual',
  'data_plate_photo',
  'photo',
  'warranty',
  'permit',
  'invoice',
  'inspection_report',
  'other',
] as const

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  receipt: 'Receipt',
  manual: 'Manual',
  data_plate_photo: 'Data plate photo',
  photo: 'Photo',
  warranty: 'Warranty',
  permit: 'Permit',
  invoice: 'Invoice',
  inspection_report: 'Inspection report',
  other: 'Other',
}

export interface HomeDocument {
  id: string
  propertyId: string
  assetId: string | null
  assetName: string | null
  warrantyId: string | null
  serviceEventId: string | null
  kind: DocumentKind
  title: string
  storageUrl: string
  mimeType: string | null
  byteSize: number | null
  capturedOn: DateOnly | null
  notes: string | null
  createdAt: string
}

export interface DocumentInput {
  assetId: string | null
  warrantyId: string | null
  serviceEventId: string | null
  kind: DocumentKind
  title: string
  storageUrl: string
  mimeType: string | null
  capturedOn: DateOnly | null
  notes: string | null
}
