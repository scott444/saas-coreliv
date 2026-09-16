import type { BillingService } from '../types'
import type { ApiClient } from '../apiClient'
import { notImplemented } from './notImplemented'

export function createHttpBillingService(_client: ApiClient): BillingService {
  return {
    getSubscription: () => notImplemented('BillingService', 'getSubscription'),
    getPlans: () => notImplemented('BillingService', 'getPlans'),
    startCheckout: () => notImplemented('BillingService', 'startCheckout'),
    openPortal: () => notImplemented('BillingService', 'openPortal'),
    cancel: () => notImplemented('BillingService', 'cancel'),
  }
}
