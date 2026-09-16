import type { OrganizationService } from '../types'
import type { ApiClient } from '../apiClient'
import { notImplemented } from './notImplemented'

export function createHttpOrganizationService(_client: ApiClient): OrganizationService {
  return {
    list: () => notImplemented('OrganizationService', 'list'),
    get: () => notImplemented('OrganizationService', 'get'),
    members: () => notImplemented('OrganizationService', 'members'),
    invite: () => notImplemented('OrganizationService', 'invite'),
    changeRole: () => notImplemented('OrganizationService', 'changeRole'),
    removeMember: () => notImplemented('OrganizationService', 'removeMember'),
  }
}
