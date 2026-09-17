/** Zones hang off an irrigation controller asset. */
export interface IrrigationZone {
  id: string
  controllerAssetId: string
  zoneNumber: number
  name: string
  headType: string | null
  headCount: number | null
  valveLocation: string | null
  runMinutes: number | null
  schedule: { days: string[]; start: string } | null
  notes: string | null
}

export type IrrigationZoneInput = Omit<IrrigationZone, 'id' | 'controllerAssetId'>

/** Shutoffs, valves, breakers, cleanouts - the things you need at 2am. */
export interface AccessPoint {
  id: string
  propertyId: string
  assetId: string | null
  assetName: string | null
  locationId: string | null
  locationName: string | null
  /** 'water_main', 'gas_valve', 'breaker', 'irrigation_drain', 'cleanout' */
  kind: string
  label: string
  description: string | null
  photoDocumentId: string | null
}

export type AccessPointInput = Omit<
  AccessPoint,
  'id' | 'propertyId' | 'assetName' | 'locationName'
>
