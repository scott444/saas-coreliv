import type { Plan, RedirectTarget, Subscription } from '@/domain'
import type { BillingService } from '../types'
import type { ApiClient } from '../apiClient'

export function createMockBillingService(client: ApiClient): BillingService {
  return {
    getSubscription: (orgId) => client.get<Subscription>(`/orgs/${orgId}/billing/subscription`),
    getPlans: () => client.get<Plan[]>('/billing/plans'),
    startCheckout: (orgId, planId) => client.post<RedirectTarget>(`/orgs/${orgId}/billing/checkout`, { planId }),
    openPortal: (orgId) => client.post<RedirectTarget>(`/orgs/${orgId}/billing/portal`),
    cancel: (orgId) => client.post<Subscription>(`/orgs/${orgId}/billing/cancel`),
  }
}
