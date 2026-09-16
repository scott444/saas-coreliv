import { Link } from 'react-router-dom'
import { Home as HomeIcon, MapPin, Plus } from 'lucide-react'
import type { Home } from '@/domain'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { useHomes } from '@/hooks/useHomes'
import { useSystems } from '@/hooks/useSystems'
import { useSubscription } from '@/hooks/useBilling'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { SystemCard } from '@/components/systems/SystemCard'
import { PageHeader } from '@/components/layout/PageHeader'

export function DashboardPage() {
  const orgId = useCurrentOrgId()
  const homes = useHomes(orgId)
  const subscription = useSubscription(orgId)
  const commandsDisabled = subscription.data?.status === 'Canceled'

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Live state across every home. Quick actions apply immediately and roll back if the device rejects them." />

      {homes.isPending ? (
        <LoadingState variant="cards" count={4} />
      ) : homes.isError ? (
        <ErrorState error={homes.error} title="Could not load homes" onRetry={() => void homes.refetch()} />
      ) : homes.data.length === 0 ? (
        <EmptyState
          icon={<HomeIcon className="size-6" />}
          title="No homes yet"
          description="Add your first home to start connecting systems."
          action={
            <Button asChild>
              <Link to="/homes">
                <Plus /> Add a home
              </Link>
            </Button>
          }
        />
      ) : (
        homes.data.map((home) => <HomeSection key={home.id} home={home} commandsDisabled={commandsDisabled} />)
      )}
    </div>
  )
}

function HomeSection({ home, commandsDisabled }: { home: Home; commandsDisabled: boolean }) {
  const systems = useSystems(home.id)

  return (
    <section aria-labelledby={`home-${home.id}`} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`home-${home.id}`} className="text-lg font-semibold tracking-tight">
            {home.name}
          </h2>
          {home.address ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" /> {home.address}
            </p>
          ) : null}
        </div>
        {systems.data ? (
          <p className="text-sm text-muted-foreground">
            {systems.data.filter((s) => s.status === 'Online').length} of {systems.data.length} online
          </p>
        ) : null}
      </div>

      {systems.isPending ? (
        <LoadingState variant="cards" count={3} />
      ) : systems.isError ? (
        <ErrorState error={systems.error} title={`Could not load systems for ${home.name}`} onRetry={() => void systems.refetch()} compact />
      ) : systems.data.length === 0 ? (
        <EmptyState title="No systems in this home" description="Connected systems will show up here with live state and controls." className="p-6" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {systems.data.map((system) => (
            <SystemCard key={system.id} system={system} commandsDisabled={commandsDisabled} />
          ))}
        </div>
      )}
    </section>
  )
}
