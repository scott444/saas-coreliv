import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, ExternalLink } from 'lucide-react'
import type { Plan, Subscription, SubscriptionStatus } from '@/domain'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { useCancelSubscription, useOpenPortal, usePlans, useStartCheckout, useSubscription } from '@/hooks/useBilling'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { ErrorState, LoadingState } from '@/components/states'
import { PlanCard } from '@/components/billing/PlanCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatCurrency, formatDate } from '@/lib/format'

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  Active: { label: 'Active', variant: 'success' },
  Trialing: { label: 'Trial', variant: 'secondary' },
  PastDue: { label: 'Past due', variant: 'warning' },
  Canceled: { label: 'Canceled', variant: 'destructive' },
}

export function BillingPage() {
  const orgId = useCurrentOrgId()
  const subscription = useSubscription(orgId)
  const plans = usePlans()

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Your plan, payment status and upgrade options. Checkout and the billing portal are mocked in this build." />

      {subscription.isPending || plans.isPending ? (
        <LoadingState variant="page" />
      ) : subscription.isError ? (
        <ErrorState error={subscription.error} title="Could not load subscription" onRetry={() => void subscription.refetch()} />
      ) : plans.isError ? (
        <ErrorState error={plans.error} title="Could not load plans" onRetry={() => void plans.refetch()} />
      ) : (
        <BillingContent orgId={orgId} subscription={subscription.data} plans={plans.data} />
      )}
    </div>
  )
}

function BillingContent({ orgId, subscription, plans }: { orgId: string; subscription: Subscription; plans: Plan[] }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const checkout = useStartCheckout(orgId)
  const portal = useOpenPortal(orgId)
  const cancel = useCancelSubscription(orgId)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const currentPlan = plans.find((p) => p.id === subscription.planId)
  const badge = STATUS_BADGE[subscription.status]
  const isCanceled = subscription.status === 'Canceled'

  const redirect = (url: string) => navigate(url)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" /> Current plan
              </CardTitle>
              <CardDescription className="mt-1">
                {isCanceled ? 'Your subscription has ended.' : `Renews ${formatDate(subscription.currentPeriodEnd)}.`}
              </CardDescription>
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-semibold">{currentPlan?.name ?? 'Unknown plan'}</p>
            <p className="text-sm text-muted-foreground">
              {currentPlan ? (currentPlan.priceMonthly === 0 ? 'Free' : `${formatCurrency(currentPlan.priceMonthly)} / month`) : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={subscription.status === 'PastDue' ? 'default' : 'outline'}
              loading={portal.isPending}
              onClick={() =>
                portal.mutate(undefined, {
                  onSuccess: ({ url }) => redirect(url),
                  onError: (err) => toast({ title: 'Could not open portal', description: err.message, variant: 'error' }),
                })
              }
            >
              <ExternalLink /> {subscription.status === 'PastDue' ? 'Update payment method' : 'Manage billing'}
            </Button>
            {!isCanceled ? (
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                Cancel subscription
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={!isCanceled && plan.id === subscription.planId}
              isUpgrade={isCanceled || plan.priceMonthly > (currentPlan?.priceMonthly ?? 0)}
              pending={checkout.isPending && checkout.variables === plan.id}
              disabled={checkout.isPending}
              onSelect={(planId) =>
                checkout.mutate(planId, {
                  onSuccess: ({ url }) => redirect(url),
                  onError: (err) => toast({ title: 'Checkout failed', description: err.message, variant: 'error' }),
                })
              }
            />
          ))}
        </div>
      </section>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>Systems stay visible, but commands are disabled until you choose a plan again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep plan
            </Button>
            <Button
              variant="destructive"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmCancel(false)
                    toast({ title: 'Subscription canceled' })
                  },
                  onError: (err) => toast({ title: 'Could not cancel', description: err.message, variant: 'error' }),
                })
              }
            >
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
