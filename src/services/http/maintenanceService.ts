import type { CompleteDueInput, DueItem, MaintenanceTask, MaintenanceTaskInput } from '@/domain'
import type { MaintenanceService } from '../types'
import type { ApiClient } from '../apiClient'

export function createHttpMaintenanceService(client: ApiClient): MaintenanceService {
  return {
    listTasks: (orgId) => client.get<MaintenanceTask[]>(`/orgs/${orgId}/tasks`),
    createTask: (propertyId, input: MaintenanceTaskInput) =>
      client.post<MaintenanceTask>(`/properties/${propertyId}/tasks`, input),
    updateTask: (taskId, input) => client.put<MaintenanceTask>(`/tasks/${taskId}`, input),
    removeTask: (taskId) => client.delete<void>(`/tasks/${taskId}`),

    due: (orgId) => client.get<DueItem[]>(`/orgs/${orgId}/due`),
    complete: (itemType, itemId, input: CompleteDueInput) =>
      client.post<void>(`/due/${itemType}/${itemId}/complete`, input),
  }
}
