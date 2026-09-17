import type { HomeDocument } from '@/domain'
import type { DocumentsService } from '../types'
import type { ApiClient } from '../apiClient'

export function createHttpDocumentsService(client: ApiClient): DocumentsService {
  return {
    list: (orgId) => client.get<HomeDocument[]>(`/orgs/${orgId}/documents`),
  }
}
