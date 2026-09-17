import type { Plan, RedirectTarget, Subscription } from '@/domain'
import type { BillingService } from '../types'
import type { ApiClient } from '../apiClient'

export function createHttpBillingService(client: ApiClient): BillingService {
  return {
    getSubscription: (orgId) => client.get<Subscription>(`/orgs/${orgId}/subscription`),
    getPlans: () => client.get<Plan[]>('/billing/plans'),
    startCheckout: (orgId, planId) =>
      client.post<RedirectTarget>(`/orgs/${orgId}/checkout`, { planId }),
    openPortal: (orgId) => client.post<RedirectTarget>(`/orgs/${orgId}/portal`),
    cancel: (orgId) => client.post<Subscription>(`/orgs/${orgId}/cancel`),
  }
}
