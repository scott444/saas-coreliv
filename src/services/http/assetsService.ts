import type {
  Asset,
  AssetDetail,
  AssetFilter,
  AssetInput,
  AssetListEntry,
  Category,
  Consumable,
  ConsumableInput,
  DocumentInput,
  HomeDocument,
  IrrigationZone,
  IrrigationZoneInput,
  ReplacementPlan,
  ServiceEvent,
  ServiceEventInput,
  Warranty,
  WarrantyInput,
} from '@/domain'
import type { AssetsService } from '../types'
import type { ApiClient } from '../apiClient'

function queryString(filter: AssetFilter | undefined): string {
  if (!filter) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value)
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export function createHttpAssetsService(client: ApiClient): AssetsService {
  return {
    list: (orgId, filter) => client.get<AssetListEntry[]>(`/orgs/${orgId}/assets${queryString(filter)}`),
    get: (assetId) => client.get<AssetDetail>(`/assets/${assetId}`),
    create: (propertyId, input: AssetInput) =>
      client.post<Asset>(`/properties/${propertyId}/assets`, input),
    update: (assetId, input) => client.put<Asset>(`/assets/${assetId}`, input),
    remove: (assetId) => client.delete<void>(`/assets/${assetId}`),

    categories: () => client.get<Category[]>('/categories'),
    replacementPlan: (orgId) =>
      client.get<Array<ReplacementPlan & { assetId: string; assetName: string; propertyName: string }>>(
        `/orgs/${orgId}/replacement-plan`,
      ),

    addWarranty: (assetId, input: WarrantyInput) =>
      client.post<Warranty>(`/assets/${assetId}/warranties`, input),
    updateWarranty: (warrantyId, input) => client.put<Warranty>(`/warranties/${warrantyId}`, input),
    removeWarranty: (warrantyId) => client.delete<void>(`/warranties/${warrantyId}`),

    addConsumable: (assetId, input: ConsumableInput) =>
      client.post<Consumable>(`/assets/${assetId}/consumables`, input),
    updateConsumable: (consumableId, input) =>
      client.put<Consumable>(`/consumables/${consumableId}`, input),
    removeConsumable: (consumableId) => client.delete<void>(`/consumables/${consumableId}`),

    addEvent: (assetId, input: ServiceEventInput) =>
      client.post<ServiceEvent>(`/assets/${assetId}/events`, input),
    removeEvent: (eventId) => client.delete<void>(`/events/${eventId}`),

    addDocument: (propertyId, input: DocumentInput) =>
      client.post<HomeDocument>(`/properties/${propertyId}/documents`, input),
    removeDocument: (documentId) => client.delete<void>(`/documents/${documentId}`),

    listZones: (assetId) => client.get<IrrigationZone[]>(`/assets/${assetId}/zones`),
    // The zone number is the natural key on a controller, so the server
    // upserts on it; `zoneId` is accepted for symmetry but is not needed.
    saveZone: (assetId, input: IrrigationZoneInput) =>
      client.put<IrrigationZone>(`/assets/${assetId}/zones`, input),
    removeZone: (zoneId) => client.delete<void>(`/zones/${zoneId}`),
  }
}
