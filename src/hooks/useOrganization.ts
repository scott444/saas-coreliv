import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Member, Role } from '@/domain'
import { useServices } from '@/app/ServicesProvider'
import { queryKeys } from '@/app/queryKeys'
import type { ServiceError } from '@/services'

export function useMembers(orgId: string) {
  const { organizations } = useServices()
  return useQuery({
    queryKey: queryKeys.orgs.members(orgId),
    queryFn: () => organizations.members(orgId),
  })
}

export function useInviteMember(orgId: string) {
  const { organizations } = useServices()
  const queryClient = useQueryClient()
  return useMutation<Member, ServiceError, { email: string; role: Role }>({
    mutationFn: ({ email, role }) => organizations.invite(orgId, email, role),
    onSuccess: (member) => {
      queryClient.setQueryData<Member[]>(queryKeys.orgs.members(orgId), (prev) => (prev ? [...prev, member] : [member]))
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all })
    },
  })
}

export function useChangeRole(orgId: string) {
  const { organizations } = useServices()
  const queryClient = useQueryClient()
  const key = queryKeys.orgs.members(orgId)
  return useMutation<Member, ServiceError, { userId: string; role: Role }, { previous: Member[] | undefined }>({
    mutationFn: ({ userId, role }) => organizations.changeRole(orgId, userId, role),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Member[]>(key)
      queryClient.setQueryData<Member[]>(key, (prev) => prev?.map((m) => (m.id === userId ? { ...m, role } : m)))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (member) => {
      queryClient.setQueryData<Member[]>(key, (prev) => prev?.map((m) => (m.id === member.id ? member : m)))
    },
  })
}

export function useRemoveMember(orgId: string) {
  const { organizations } = useServices()
  const queryClient = useQueryClient()
  const key = queryKeys.orgs.members(orgId)
  return useMutation<void, ServiceError, string>({
    mutationFn: (userId) => organizations.removeMember(orgId, userId),
    onSuccess: (_, userId) => {
      queryClient.setQueryData<Member[]>(key, (prev) => prev?.filter((m) => m.id !== userId))
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all })
    },
  })
}
