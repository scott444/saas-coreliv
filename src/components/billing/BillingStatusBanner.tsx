import { Link } from 'react-router-dom'
import { AlertTriangle, XCircle } from 'lucide-react'
import type { Subscription } from '@/domain'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useSubscription } from '@/hooks/useBilling'
import { formatDate } from '@/lib/format'

/**
 * Presentational banner. Renders nothing for Active/Trialing subscriptions.
 */
export function BillingStatusBannerView({ subscription, onManage }: { subscription: Subscription; onManage?: () => void }) {
  if (subscription.status === 'PastDue') {
    return (
      <Alert variant="warning" data-testid="billing-banner">
        <AlertTriangle />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <AlertTitle>Payment past due</AlertTitle>
            <AlertDescription>
              Your last payment failed. Update your payment method before {formatDate(subscription.currentPeriodEnd)} to keep control of your
              systems.
            </AlertDescription>
          </div>
          {onManage ? (
            <Button size="sm" variant="outline" onClick={onManage} className="shrink-0">
              Update payment
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild className="shrink-0">
              <Link to="/billing">Update payment</Link>
            </Button>
          )}
        </div>
      </Alert>
    )
  }

  if (subscription.status === 'Canceled') {
    return (
      <Alert variant="destructive" data-testid="billing-banner">
        <XCircle />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <AlertTitle>Subscription canceled</AlertTitle>
            <AlertDescription>Your plan has ended. Systems stay visible but commands are disabled until you reactivate.</AlertDescription>
          </div>
          <Button size="sm" asChild className="shrink-0">
            <Link to="/billing">Choose a plan</Link>
          </Button>
        </div>
      </Alert>
    )
  }

  return null
}

/** Connected banner used in the app shell. */
export function BillingStatusBanner({ orgId }: { orgId: string }) {
  const { data } = useSubscription(orgId)
  if (!data) return null
  return <BillingStatusBannerView subscription={data} />
}
