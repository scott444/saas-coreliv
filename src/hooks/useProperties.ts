import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AccessPoint,
  AccessPointInput,
  Location,
  LocationInput,
  Property,
  PropertyInput,
} from '@/domain'
import { useServices } from '@/app/ServicesProvider'
import { queryKeys } from '@/app/queryKeys'
import type { ServiceError } from '@/services'

export function useProperties(orgId: string) {
  const { properties } = useServices()
  return useQuery<Property[], ServiceError>({
    queryKey: queryKeys.properties.list(orgId),
    queryFn: () => properties.list(orgId),
    staleTime: 60_000,
  })
}

export function useLocations(propertyId: string | null) {
  const { properties } = useServices()
  return useQuery<Location[], ServiceError>({
    queryKey: queryKeys.properties.locations(propertyId ?? 'none'),
    queryFn: () => properties.listLocations(propertyId as string),
    enabled: propertyId !== null,
    staleTime: 5 * 60_000,
  })
}

export function useAccessPoints(propertyId: string | null) {
  const { properties } = useServices()
  return useQuery<AccessPoint[], ServiceError>({
    queryKey: queryKeys.properties.accessPoints(propertyId ?? 'none'),
    queryFn: () => properties.listAccessPoints(propertyId as string),
    enabled: propertyId !== null,
    staleTime: 5 * 60_000,
  })
}

export function useSaveProperty(orgId: string) {
  const { properties } = useServices()
  const queryClient = useQueryClient()
  return useMutation<Property, ServiceError, { propertyId?: string; input: PropertyInput }>({
    mutationFn: ({ propertyId, input }) =>
      propertyId ? properties.update(propertyId, input) : properties.create(orgId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.properties.list(orgId) })
      // The organization switcher shows a property count.
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all })
    },
  })
}

export function useDeleteProperty(orgId: string) {
  const { properties } = useServices()
  const queryClient = useQueryClient()
  return useMutation<void, ServiceError, string>({
    mutationFn: (propertyId) => properties.remove(propertyId),
    onSuccess: () => {
      // Deleting a property cascades to its assets, tasks and documents, so
      // drop everything under the organization rather than pick.
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.detail(orgId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all })
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}

export function useSaveLocation(propertyId: string) {
  const { properties } = useServices()
  const queryClient = useQueryClient()
  return useMutation<Location, ServiceError, { locationId?: string; input: LocationInput }>({
    mutationFn: ({ locationId, input }) =>
      locationId
        ? properties.updateLocation(locationId, input)
        : properties.createLocation(propertyId, input),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.properties.locations(propertyId) }),
  })
}

export function useDeleteLocation(propertyId: string) {
  const { properties } = useServices()
  const queryClient = useQueryClient()
  return useMutation<void, ServiceError, string>({
    mutationFn: (locationId) => properties.removeLocation(locationId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.properties.locations(propertyId) }),
  })
}

export function useSaveAccessPoint(propertyId: string) {
  const { properties } = useServices()
  const queryClient = useQueryClient()
  return useMutation<
    AccessPoint,
    ServiceError,
    { accessPointId?: string; input: AccessPointInput }
  >({
    mutationFn: ({ accessPointId, input }) =>
      accessPointId
        ? properties.updateAccessPoint(accessPointId, input)
        : properties.createAccessPoint(propertyId, input),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.properties.accessPoints(propertyId),
      }),
  })
}

export function useDeleteAccessPoint(propertyId: string) {
  const { properties } = useServices()
  const queryClient = useQueryClient()
  return useMutation<void, ServiceError, string>({
    mutationFn: (accessPointId) => properties.removeAccessPoint(accessPointId),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.properties.accessPoints(propertyId),
      }),
  })
}
