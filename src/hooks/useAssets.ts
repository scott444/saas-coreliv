import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Asset,
  AssetDetail,
  AssetInput,
  AssetListEntry,
  Category,
  Consumable,
  ConsumableInput,
  DocumentInput,
  HomeDocument,
  IrrigationZone,
  IrrigationZoneInput,
  ServiceEvent,
  ServiceEventInput,
  Warranty,
  WarrantyInput,
} from '@/domain'
import { useServices } from '@/app/ServicesProvider'
import { queryKeys } from '@/app/queryKeys'
import type { ServiceError } from '@/services'

/**
 * The whole register for an organization, fetched once.
 *
 * Filtering happens in `filterAssets()` against this cached list rather than
 * by refetching per keystroke: it is one small payload, and search that waits
 * on a round trip feels broken at this size.
 */
export function useAssetRegister(orgId: string) {
  const { assets } = useServices()
  return useQuery<AssetListEntry[], ServiceError>({
    queryKey: queryKeys.assets.register(orgId),
    queryFn: () => assets.list(orgId),
    staleTime: 30_000,
  })
}

export function useAsset(assetId: string) {
  const { assets } = useServices()
  return useQuery<AssetDetail, ServiceError>({
    queryKey: queryKeys.assets.detail(assetId),
    queryFn: () => assets.get(assetId),
  })
}

/** Global taxonomy. It never changes within a session. */
export function useCategories() {
  const { assets } = useServices()
  return useQuery<Category[], ServiceError>({
    queryKey: queryKeys.assets.categories,
    queryFn: () => assets.categories(),
    staleTime: Infinity,
  })
}

export function useReplacementPlan(orgId: string) {
  const { assets } = useServices()
  return useQuery({
    queryKey: queryKeys.assets.replacement(orgId),
    queryFn: () => assets.replacementPlan(orgId),
    staleTime: 5 * 60_000,
  })
}

/**
 * Anything that changes an asset invalidates two things: the asset page and
 * the register row behind it. Centralised here so no mutation forgets one.
 */
function useAssetInvalidation(orgId: string, assetId?: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.assets.register(orgId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.due(orgId) })
    if (assetId) void queryClient.invalidateQueries({ queryKey: queryKeys.assets.detail(assetId) })
  }
}

export function useCreateAsset(orgId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId)
  const queryClient = useQueryClient()
  return useMutation<Asset, ServiceError, { propertyId: string; input: AssetInput }>({
    mutationFn: ({ propertyId, input }) => assets.create(propertyId, input),
    onSuccess: () => {
      invalidate()
      // The property card shows an asset count.
      void queryClient.invalidateQueries({ queryKey: queryKeys.properties.list(orgId) })
    },
  })
}

export function useUpdateAsset(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<Asset, ServiceError, AssetInput>({
    mutationFn: (input) => assets.update(assetId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteAsset(orgId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId)
  const queryClient = useQueryClient()
  return useMutation<void, ServiceError, string>({
    mutationFn: (assetId) => assets.remove(assetId),
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: queryKeys.properties.list(orgId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Sub-resources
// ---------------------------------------------------------------------------

export function useSaveWarranty(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<Warranty, ServiceError, { warrantyId?: string; input: WarrantyInput }>({
    mutationFn: ({ warrantyId, input }) =>
      warrantyId ? assets.updateWarranty(warrantyId, input) : assets.addWarranty(assetId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteWarranty(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<void, ServiceError, string>({
    mutationFn: (warrantyId) => assets.removeWarranty(warrantyId),
    onSuccess: invalidate,
  })
}

export function useSaveConsumable(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<Consumable, ServiceError, { consumableId?: string; input: ConsumableInput }>({
    mutationFn: ({ consumableId, input }) =>
      consumableId ? assets.updateConsumable(consumableId, input) : assets.addConsumable(assetId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteConsumable(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<void, ServiceError, string>({
    mutationFn: (consumableId) => assets.removeConsumable(consumableId),
    onSuccess: invalidate,
  })
}

export function useAddServiceEvent(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<ServiceEvent, ServiceError, ServiceEventInput>({
    mutationFn: (input) => assets.addEvent(assetId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteServiceEvent(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<void, ServiceError, string>({
    mutationFn: (eventId) => assets.removeEvent(eventId),
    onSuccess: invalidate,
  })
}

export function useAddDocument(orgId: string, assetId?: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  const queryClient = useQueryClient()
  return useMutation<HomeDocument, ServiceError, { propertyId: string; input: DocumentInput }>({
    mutationFn: ({ propertyId, input }) => assets.addDocument(propertyId, input),
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.list(orgId) })
    },
  })
}

export function useDeleteDocument(orgId: string, assetId?: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  const queryClient = useQueryClient()
  return useMutation<void, ServiceError, string>({
    mutationFn: (documentId) => assets.removeDocument(documentId),
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.list(orgId) })
    },
  })
}

export function useSaveZone(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<IrrigationZone, ServiceError, IrrigationZoneInput>({
    mutationFn: (input) => assets.saveZone(assetId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteZone(orgId: string, assetId: string) {
  const { assets } = useServices()
  const invalidate = useAssetInvalidation(orgId, assetId)
  return useMutation<void, ServiceError, string>({
    mutationFn: (zoneId) => assets.removeZone(zoneId),
    onSuccess: invalidate,
  })
}
