import type { DateOnly, RecurrenceUnit } from './dates.js'

/** Filters, bulbs, batteries, softener salt, anode rods. */
export interface Consumable {
  id: string
  assetId: string
  name: string
  partNumber: string | null
  /** "20x25x4 MERV 11" - the thing you actually have to match at the store. */
  sizeOrSpec: string | null
  intervalValue: number | null
  intervalUnit: RecurrenceUnit | null
  lastReplacedOn: DateOnly | null
  quantityOnHand: number
  reorderUrl: string | null
  unitCost: number | null
  notes: string | null
}

export type ConsumableInput = Omit<Consumable, 'id' | 'assetId'>
