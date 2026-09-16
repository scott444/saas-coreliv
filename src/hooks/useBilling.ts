import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RedirectTarget, Subscription } from '@/domain'
import { useServices } from '@/app/ServicesProvider'
import { queryKeys } from '@/app/queryKeys'
import type { ServiceError } from '@/services'

export function useSubscription(orgId: string) {
  const { billing } = useServices()
  return useQuery({
    queryKey: queryKeys.billing.subscription(orgId),
    queryFn: () => billing.getSubscription(orgId),
    staleTime: 60_000,
  })
}

export function usePlans() {
  const { billing } = useServices()
  return useQuery({
    queryKey: queryKeys.billing.plans,
    queryFn: () => billing.getPlans(),
    staleTime: 10 * 60_000,
  })
}

export function useStartCheckout(orgId: string) {
  const { billing } = useServices()
  const queryClient = useQueryClient()
  return useMutation<RedirectTarget, ServiceError, string>({
    mutationFn: (planId) => billing.startCheckout(orgId, planId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.billing.subscription(orgId) }),
  })
}

export function useOpenPortal(orgId: string) {
  const { billing } = useServices()
  const queryClient = useQueryClient()
  return useMutation<RedirectTarget, ServiceError, void>({
    mutationFn: () => billing.openPortal(orgId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.billing.subscription(orgId) }),
  })
}

export function useCancelSubscription(orgId: string) {
  const { billing } = useServices()
  const queryClient = useQueryClient()
  return useMutation<Subscription, ServiceError, void>({
    mutationFn: () => billing.cancel(orgId),
    onSuccess: (subscription) => queryClient.setQueryData(queryKeys.billing.subscription(orgId), subscription),
  })
}
