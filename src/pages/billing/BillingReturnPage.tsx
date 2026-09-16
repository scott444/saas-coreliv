import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { usePlans, useSubscription } from '@/hooks/useBilling'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/states'

/**
 * Where the mock checkout / portal "redirects" back to. A real provider would
 * send the user here with a session id to confirm.
 */
export function BillingReturnPage() {
  const [params] = useSearchParams()
  const orgId = useCurrentOrgId()
  const subscription = useSubscription(orgId)
  const plans = usePlans()

  const fromCheckout = params.get('checkout')
  const fromPortal = params.get('portal')
  const plan = plans.data?.find((p) => p.id === fromCheckout)

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <CardTitle>{fromPortal ? 'Billing details updated' : 'You are all set'}</CardTitle>
          <CardDescription>
            {fromPortal
              ? 'Returned from the (mock) billing portal.'
              : plan
                ? `Your organization is now on the ${plan.name} plan.`
                : 'Returned from (mock) checkout.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {subscription.isPending ? (
            <LoadingState variant="inline" />
          ) : subscription.data ? (
            <p className="text-sm text-muted-foreground">
              Status: <span className="font-medium text-foreground">{subscription.data.status}</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/">Go to dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/billing">Back to billing</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
