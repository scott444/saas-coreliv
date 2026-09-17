import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { HomeDocument, Vendor, VendorInput } from '@/domain'
import { useServices } from '@/app/ServicesProvider'
import { queryKeys } from '@/app/queryKeys'
import type { ServiceError } from '@/services'

export function useVendors(orgId: string) {
  const { vendors } = useServices()
  return useQuery<Vendor[], ServiceError>({
    queryKey: queryKeys.vendors.list(orgId),
    queryFn: () => vendors.list(orgId),
    staleTime: 5 * 60_000,
  })
}

export function useSaveVendor(orgId: string) {
  const { vendors } = useServices()
  const queryClient = useQueryClient()
  return useMutation<Vendor, ServiceError, { vendorId?: string; input: VendorInput }>({
    mutationFn: ({ vendorId, input }) =>
      vendorId ? vendors.update(vendorId, input) : vendors.create(orgId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.vendors.list(orgId) }),
  })
}

export function useDeleteVendor(orgId: string) {
  const { vendors } = useServices()
  const queryClient = useQueryClient()
  return useMutation<void, ServiceError, string>({
    mutationFn: (vendorId) => vendors.remove(vendorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendors.list(orgId) })
      // References are ON DELETE SET NULL, so anything showing a vendor name
      // is now showing one that no longer exists.
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.tasks(orgId) })
    },
  })
}

export function useDocuments(orgId: string) {
  const { documents } = useServices()
  return useQuery<HomeDocument[], ServiceError>({
    queryKey: queryKeys.documents.list(orgId),
    queryFn: () => documents.list(orgId),
    staleTime: 60_000,
  })
}
