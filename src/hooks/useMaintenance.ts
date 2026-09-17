import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CompleteDueInput, DueItem, MaintenanceTask, MaintenanceTaskInput } from '@/domain'
import { useServices } from '@/app/ServicesProvider'
import { queryKeys } from '@/app/queryKeys'
import type { ServiceError } from '@/services'

export function useDueItems(orgId: string) {
  const { maintenance } = useServices()
  return useQuery<DueItem[], ServiceError>({
    queryKey: queryKeys.maintenance.due(orgId),
    queryFn: () => maintenance.due(orgId),
    staleTime: 30_000,
  })
}

export function useTasks(orgId: string) {
  const { maintenance } = useServices()
  return useQuery<MaintenanceTask[], ServiceError>({
    queryKey: queryKeys.maintenance.tasks(orgId),
    queryFn: () => maintenance.listTasks(orgId),
    staleTime: 60_000,
  })
}

/**
 * Completing an item touches four places: the due list it came from, the task
 * list behind it, the register's open-item count, and the asset's service log.
 * Invalidating all of them is cheaper to keep correct than patching each cache
 * by hand.
 */
function useMaintenanceInvalidation(orgId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.due(orgId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.tasks(orgId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.assets.register(orgId) })
    void queryClient.invalidateQueries({ queryKey: ['assets'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.properties.list(orgId) })
  }
}

export function useSaveTask(orgId: string) {
  const { maintenance } = useServices()
  const invalidate = useMaintenanceInvalidation(orgId)
  return useMutation<
    MaintenanceTask,
    ServiceError,
    { taskId?: string; propertyId: string; input: MaintenanceTaskInput }
  >({
    mutationFn: ({ taskId, propertyId, input }) =>
      taskId ? maintenance.updateTask(taskId, input) : maintenance.createTask(propertyId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteTask(orgId: string) {
  const { maintenance } = useServices()
  const invalidate = useMaintenanceInvalidation(orgId)
  return useMutation<void, ServiceError, string>({
    mutationFn: (taskId) => maintenance.removeTask(taskId),
    onSuccess: invalidate,
  })
}

export function useCompleteDueItem(orgId: string) {
  const { maintenance } = useServices()
  const invalidate = useMaintenanceInvalidation(orgId)
  return useMutation<
    void,
    ServiceError,
    { itemType: 'task' | 'consumable'; itemId: string; input: CompleteDueInput }
  >({
    mutationFn: ({ itemType, itemId, input }) => maintenance.complete(itemType, itemId, input),
    onSuccess: invalidate,
  })
}
