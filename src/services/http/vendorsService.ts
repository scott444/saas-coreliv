import type { Vendor, VendorInput } from '@/domain'
import type { VendorsService } from '../types'
import type { ApiClient } from '../apiClient'

export function createHttpVendorsService(client: ApiClient): VendorsService {
  return {
    list: (orgId) => client.get<Vendor[]>(`/orgs/${orgId}/vendors`),
    create: (orgId, input: VendorInput) => client.post<Vendor>(`/orgs/${orgId}/vendors`, input),
    update: (vendorId, input) => client.put<Vendor>(`/vendors/${vendorId}`, input),
    remove: (vendorId) => client.delete<void>(`/vendors/${vendorId}`),
  }
}
