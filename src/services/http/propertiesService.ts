import type { AccessPoint, AccessPointInput, Location, LocationInput, Property, PropertyInput } from '@/domain'
import type { PropertiesService } from '../types'
import type { ApiClient } from '../apiClient'

export function createHttpPropertiesService(client: ApiClient): PropertiesService {
  return {
    list: (orgId) => client.get<Property[]>(`/orgs/${orgId}/properties`),
    create: (orgId, input: PropertyInput) =>
      client.post<Property>(`/orgs/${orgId}/properties`, input),
    update: (propertyId, input) => client.put<Property>(`/properties/${propertyId}`, input),
    remove: (propertyId) => client.delete<void>(`/properties/${propertyId}`),

    listLocations: (propertyId) => client.get<Location[]>(`/properties/${propertyId}/locations`),
    createLocation: (propertyId, input: LocationInput) =>
      client.post<Location>(`/properties/${propertyId}/locations`, input),
    updateLocation: (locationId, input) => client.put<Location>(`/locations/${locationId}`, input),
    removeLocation: (locationId) => client.delete<void>(`/locations/${locationId}`),

    listAccessPoints: (propertyId) =>
      client.get<AccessPoint[]>(`/properties/${propertyId}/access-points`),
    createAccessPoint: (propertyId, input: AccessPointInput) =>
      client.post<AccessPoint>(`/properties/${propertyId}/access-points`, input),
    updateAccessPoint: (accessPointId, input) =>
      client.put<AccessPoint>(`/access-points/${accessPointId}`, input),
    removeAccessPoint: (accessPointId) => client.delete<void>(`/access-points/${accessPointId}`),
  }
}
