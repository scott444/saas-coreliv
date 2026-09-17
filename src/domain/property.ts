import type { DateOnly } from './dates.js'

/**
 * A home. Everything else in the model reaches an organization by walking up
 * to its property, which is why this is the only table carrying `orgId`.
 */
export interface Property {
  id: string
  name: string
  address: string | null
  yearBuilt: number | null
  purchaseDate: DateOnly | null
  notes: string | null
  createdAt: string
  /** Denormalized counts for the property switcher and list. */
  assetCount: number
  openItemCount: number
}

export interface PropertyInput {
  name: string
  address: string | null
  yearBuilt: number | null
  purchaseDate: DateOnly | null
  notes: string | null
}

/** A room or area: "Kitchen", "Basement mechanical room", "Front yard". */
export interface Location {
  id: string
  propertyId: string
  name: string
  floor: string | null
  assetCount: number
}

export interface LocationInput {
  name: string
  floor: string | null
}
