import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Home, HomeInput } from '@/domain'
import { useServices } from '@/app/ServicesProvider'
import { queryKeys } from '@/app/queryKeys'

export function useHomes(orgId: string) {
  const { homeSystems } = useServices()
  return useQuery({
    queryKey: queryKeys.homes.list(orgId),
    queryFn: () => homeSystems.listHomes(orgId),
  })
}

export function useCreateHome(orgId: string) {
  const { homeSystems } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: HomeInput) => homeSystems.createHome(orgId, input),
    onSuccess: (home) => {
      queryClient.setQueryData<Home[]>(queryKeys.homes.list(orgId), (prev) => (prev ? [...prev, home] : [home]))
    },
  })
}

export function useUpdateHome(orgId: string) {
  const { homeSystems } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ homeId, input }: { homeId: string; input: HomeInput }) => homeSystems.updateHome(homeId, input),
    onSuccess: (home) => {
      queryClient.setQueryData<Home[]>(queryKeys.homes.list(orgId), (prev) => prev?.map((h) => (h.id === home.id ? home : h)))
    },
  })
}

export function useDeleteHome(orgId: string) {
  const { homeSystems } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (homeId: string) => homeSystems.deleteHome(homeId),
    onSuccess: (_, homeId) => {
      queryClient.setQueryData<Home[]>(queryKeys.homes.list(orgId), (prev) => prev?.filter((h) => h.id !== homeId))
      queryClient.removeQueries({ queryKey: queryKeys.systems.list(homeId) })
    },
  })
}
