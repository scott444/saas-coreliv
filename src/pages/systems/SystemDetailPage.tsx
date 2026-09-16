import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, WifiOff } from 'lucide-react'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { useSystem, useSystemEvents, useSystemHistory, useSystemState } from '@/hooks/useSystems'
import { useSubscription } from '@/hooks/useBilling'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { SystemStatusBadge, SystemTypeIcon } from '@/components/systems/SystemMeta'
import { SystemControls } from '@/components/systems/SystemControls'
import { HistoryChart } from '@/components/systems/HistoryChart'
import { EventList } from '@/components/systems/EventList'
import { HardwareCard } from '@/components/systems/HardwareCard'
import { PageHeader } from '@/components/layout/PageHeader'

export function SystemDetailPage() {
  const { systemId = '' } = useParams()
  const orgId = useCurrentOrgId()
  const system = useSystem(systemId)
  const subscription = useSubscription(orgId)

  if (system.isPending) return <LoadingState variant="page" />
  if (system.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState error={system.error} title="Could not load this system" onRetry={() => void system.refetch()} />
      </div>
    )
  }

  const s = system.data
  const subscriptionEnded = subscription.data?.status === 'Canceled'

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        eyebrow={
          <div className="flex items-center gap-2">
            <SystemTypeIcon type={s.type} className="size-8 [&>svg]:size-4" />
            <span className="text-sm text-muted-foreground">{s.type}</span>
          </div>
        }
        title={
          <span className="flex items-center gap-3">
            {s.name}
            <SystemStatusBadge status={s.status} />
          </span>
        }
      />

      {s.status === 'Error' ? (
        <Alert variant="destructive">
          <AlertTitle>Device reports an error</AlertTitle>
          <AlertDescription>Commands are rejected until the device is reset. Check the recent events below for details.</AlertDescription>
        </Alert>
      ) : null}
      {subscriptionEnded ? (
        <Alert variant="warning">
          <AlertTitle>Controls locked</AlertTitle>
          <AlertDescription>
            Your subscription has ended. <Link to="/billing" className="font-medium underline underline-offset-4">Reactivate</Link> to send commands.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Controls</CardTitle>
            <CardDescription>Changes apply immediately and roll back if the device rejects them.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatePanel systemId={s.id} offline={s.status === 'Offline'} subscriptionEnded={subscriptionEnded} system={s} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent events</CardTitle>
          </CardHeader>
          <CardContent>
            <EventsPanel systemId={s.id} />
          </CardContent>
        </Card>
      </div>

      <HardwareCard systemId={s.id} />

      <Card>
        <CardHeader>
          <CardTitle>Last 24 hours</CardTitle>
          <CardDescription>Readings every 15 minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <HistoryPanel systemId={s.id} />
        </CardContent>
      </Card>
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/">
        <ArrowLeft /> Dashboard
      </Link>
    </Button>
  )
}

function StatePanel({ systemId, offline, subscriptionEnded, system }: { systemId: string; offline: boolean; subscriptionEnded: boolean; system: NonNullable<ReturnType<typeof useSystem>['data']> }) {
  const state = useSystemState(systemId, { enabled: !offline })

  if (offline) {
    return <EmptyState icon={<WifiOff className="size-6" />} title="Device is offline" description="Live state and controls will return when the device reconnects." className="p-6" />
  }
  if (state.isPending) return <LoadingState variant="list" count={4} />
  if (state.isError) return <ErrorState error={state.error} onRetry={() => void state.refetch()} compact />
  return <SystemControls system={system} state={state.data} disabled={subscriptionEnded} />
}

function EventsPanel({ systemId }: { systemId: string }) {
  const events = useSystemEvents(systemId)
  if (events.isPending) return <LoadingState variant="list" count={4} />
  if (events.isError) return <ErrorState error={events.error} onRetry={() => void events.refetch()} compact />
  if (events.data.length === 0) return <EmptyState title="No events yet" className="p-6" />
  return <EventList events={events.data} />
}

function HistoryPanel({ systemId }: { systemId: string }) {
  const history = useSystemHistory(systemId, '24h')
  if (history.isPending) return <LoadingState variant="list" count={1} className="[&_div]:h-64" />
  if (history.isError) return <ErrorState error={history.error} onRetry={() => void history.refetch()} compact />
  if (history.data.length === 0) return <EmptyState title="No readings yet" description="History appears once the device has reported for a while." className="p-6" />
  return <HistoryChart readings={history.data} />
}
