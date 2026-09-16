import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { HistoryRange, SystemCommand, SystemState } from '@/domain'
import { reduceCommand } from '@/domain/reduceCommand'
import { useServices } from '@/app/ServicesProvider'
import { queryKeys } from '@/app/queryKeys'
import { ServiceError } from '@/services'

const LIVE_STATE_INTERVAL_MS = 10_000

export function useSystems(homeId: string) {
  const { homeSystems } = useServices()
  return useQuery({
    queryKey: queryKeys.systems.list(homeId),
    queryFn: () => homeSystems.listSystems(homeId),
  })
}

export function useSystem(systemId: string) {
  const { homeSystems } = useServices()
  return useQuery({
    queryKey: queryKeys.systems.detail(systemId),
    queryFn: () => homeSystems.getSystem(systemId),
  })
}

export function useSystemState(systemId: string, options: { enabled?: boolean; live?: boolean } = {}) {
  const { homeSystems } = useServices()
  return useQuery({
    queryKey: queryKeys.systems.state(systemId),
    queryFn: () => homeSystems.getSystemState(systemId),
    enabled: options.enabled ?? true,
    refetchInterval: options.live === false ? false : LIVE_STATE_INTERVAL_MS,
    staleTime: 5_000,
  })
}

export function useSystemHistory(systemId: string, range: HistoryRange = '24h') {
  const { homeSystems } = useServices()
  return useQuery({
    queryKey: queryKeys.systems.history(systemId, range),
    queryFn: () => homeSystems.getHistory(systemId, range),
    staleTime: 60_000,
  })
}

export function useSystemEvents(systemId: string) {
  const { homeSystems } = useServices()
  return useQuery({
    queryKey: queryKeys.systems.events(systemId),
    queryFn: () => homeSystems.getEvents(systemId),
  })
}

interface CommandContext {
  previous: SystemState | undefined
}

/**
 * Sends a command with an optimistic state update. On failure the previous
 * state is restored and the error surfaces to the caller via `onError`.
 */
export function useSendCommand(systemId: string, callbacks: { onError?: (error: ServiceError) => void; onSuccess?: () => void } = {}) {
  const { homeSystems } = useServices()
  const queryClient = useQueryClient()
  const stateKey = queryKeys.systems.state(systemId)

  return useMutation<SystemState, ServiceError, SystemCommand, CommandContext>({
    mutationFn: (command) => homeSystems.sendCommand(systemId, command),
    onMutate: async (command) => {
      await queryClient.cancelQueries({ queryKey: stateKey })
      const previous = queryClient.getQueryData<SystemState>(stateKey)
      if (previous) queryClient.setQueryData<SystemState>(stateKey, reduceCommand(previous, command))
      return { previous }
    },
    onError: (error, _command, context) => {
      if (context?.previous) queryClient.setQueryData(stateKey, context.previous)
      callbacks.onError?.(error)
    },
    onSuccess: (state) => {
      queryClient.setQueryData(stateKey, state)
      callbacks.onSuccess?.()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.systems.events(systemId) })
    },
  })
}
