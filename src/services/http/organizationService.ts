import type { Member, Organization, Role } from '@/domain'
import type { OrganizationService } from '../types'
import type { ApiClient } from '../apiClient'

export function createHttpOrganizationService(client: ApiClient): OrganizationService {
  return {
    list: () => client.get<Organization[]>('/orgs'),
    get: (orgId) => client.get<Organization>(`/orgs/${orgId}`),
    members: (orgId) => client.get<Member[]>(`/orgs/${orgId}/members`),
    invite: (orgId, email, role: Role) =>
      client.post<Member>(`/orgs/${orgId}/members`, { email, role }),
    changeRole: (orgId, userId, role: Role) =>
      client.patch<Member>(`/orgs/${orgId}/members/${userId}`, { role }),
    removeMember: (orgId, userId) => client.delete<void>(`/orgs/${orgId}/members/${userId}`),
  }
}
