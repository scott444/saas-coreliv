import type { Asset, ReplacementPlan } from './asset.js'
import type { Category } from './category.js'
import type { Consumable } from './consumable.js'
import type { HomeDocument } from './document.js'
import type { IrrigationZone } from './irrigation.js'
import type { MaintenanceTask } from './maintenance.js'
import type { ServiceEvent } from './service.js'
import type { Vendor } from './vendor.js'
import type { Warranty } from './warranty.js'

export interface NamedRef {
  id: string
  name: string
}

/**
 * Everything the asset page shows, assembled in one request.
 *
 * The alternative - a query per tab - meant six round trips for a page that is
 * always opened whole, and six cache entries to invalidate after any edit.
 */
export interface AssetDetail {
  asset: Asset
  property: NamedRef
  category: Category | null
  groupName: string | null
  location: NamedRef | null
  parent: NamedRef | null
  children: NamedRef[]
  retailer: Vendor | null
  installer: Vendor | null
  replacedBy: NamedRef | null
  warranties: Warranty[]
  consumables: Consumable[]
  tasks: MaintenanceTask[]
  events: ServiceEvent[]
  documents: HomeDocument[]
  irrigationZones: IrrigationZone[]
  replacement: ReplacementPlan
}

/** Filters the register understands, mirrored in the query string. */
export interface AssetFilter {
  propertyId?: string
  categoryId?: string
  status?: string
  warrantyState?: string
  search?: string
}
