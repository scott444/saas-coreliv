export interface Plan {
  id: string
  name: string
  priceMonthly: number
  features: string[]
  /** Null when the plan does not cap assets. */
  assetLimit: number | null
}

export type SubscriptionStatus = 'Active' | 'PastDue' | 'Canceled' | 'Trialing'

export interface Subscription {
  planId: string
  status: SubscriptionStatus
  currentPeriodEnd: string
}

export interface RedirectTarget {
  url: string
}
