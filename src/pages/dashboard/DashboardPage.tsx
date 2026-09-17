import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, Home, ShieldAlert, Wrench } from 'lucide-react'
import type { DueItem } from '@/domain'
import { useAuth } from '@/app/AuthProvider'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { useAssetRegister } from '@/hooks/useAssets'
import { useCompleteDueItem, useDueItems } from '@/hooks/useMaintenance'
import { useProperties } from '@/hooks/useProperties'
import { useVendors } from '@/hooks/useVendors'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DueTable } from '@/components/maintenance/DueTable'
import { CompleteDueDialog } from '@/components/maintenance/CompleteDueDialog'
import { WarrantyBadge } from '@/components/assets/StatusBadges'
import { formatDateOnly } from '@/lib/format'

export function DashboardPage() {
  const orgId = useCurrentOrgId()
  const { user } = useAuth()

  const due = useDueItems(orgId)
  const register = useAssetRegister(orgId)
  const properties = useProperties(orgId)
  const vendors = useVendors(orgId)
  const complete = useCompleteDueItem(orgId)

  const [completing, setCompleting] = useState<DueItem | null>(null)

  const items = useMemo(() => due.data ?? [], [due.data])
  const entries = useMemo(() => register.data ?? [], [register.data])

  // The dashboard answers one question - what needs doing - so it shows only
  // what is actually actionable now. Everything else is a click away.
  const actionable = items.filter(
    (item) => item.status === 'overdue' || item.status === 'due' || item.status === 'soon',
  )
  const expiring = entries.filter((entry) => entry.warranty.state === 'expiring')
  const needsRepair = entries.filter((entry) => entry.status === 'needs_repair')
  const multipleProperties = (properties.data?.length ?? 0) > 1

  const isPending = due.isPending || register.isPending
  const error = due.error ?? register.error

  const firstName = user?.name.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${firstName}`}
        description="What needs doing, and what is about to stop being covered."
      />

      {isPending ? (
        <LoadingState variant="page" />
      ) : error ? (
        <ErrorState
          error={error}
          title="Could not load your dashboard"
          onRetry={() => {
            void due.refetch()
            void register.refetch()
          }}
        />
      ) : entries.length === 0 && items.length === 0 ? (
        <EmptyState
          icon={<Home className="size-6" />}
          title="Nothing here yet"
          description="Add a property, then start recording the things you would otherwise have to go and read a label to remember."
          action={
            <Button asChild>
              <Link to="/properties">Set up a property</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              to="/maintenance"
              icon={<CircleAlert className="size-4" />}
              count={items.filter((i) => i.status === 'overdue').length}
              label="Overdue"
              tone="destructive"
            />
            <StatCard
              to="/assets"
              icon={<ShieldAlert className="size-4" />}
              count={expiring.length}
              label="Warranties expiring"
              tone="warning"
            />
            <StatCard
              to="/assets"
              icon={<Wrench className="size-4" />}
              count={needsRepair.length}
              label="Needs repair"
              tone="warning"
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Needs doing</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/maintenance">
                  All maintenance <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {actionable.length === 0 ? (
                <EmptyState
                  title="Nothing is due"
                  description="Everything with a schedule is inside its window."
                />
              ) : (
                <DueTable
                  items={actionable}
                  showProperty={multipleProperties}
                  canEdit
                  onComplete={setCompleting}
                />
              )}
            </CardContent>
          </Card>

          {expiring.length > 0 || needsRepair.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {expiring.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Cover running out</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {expiring.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <Link
                              to={`/assets/${entry.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {entry.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {[entry.brand, entry.modelNumber].filter(Boolean).join(' ') ||
                                entry.propertyName}
                            </p>
                          </div>
                          <WarrantyBadge summary={entry.warranty} />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              {needsRepair.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Flagged as needing repair</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {needsRepair.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <Link
                              to={`/assets/${entry.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {entry.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {entry.lastServicedOn
                                ? `last looked at ${formatDateOnly(entry.lastServicedOn)}`
                                : 'never serviced'}
                            </p>
                          </div>
                          {entry.tags.includes('replace-soon') ? (
                            <Badge variant="outline">replace soon</Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <CompleteDueDialog
        item={completing}
        vendors={vendors.data ?? []}
        open={completing !== null}
        onOpenChange={(open) => !open && setCompleting(null)}
        pending={complete.isPending}
        error={complete.error}
        onSubmit={(input) => {
          if (!completing) return
          complete.mutate(
            { itemType: completing.itemType, itemId: completing.id, input },
            { onSuccess: () => setCompleting(null) },
          )
        }}
      />
    </div>
  )
}

const TONES = {
  destructive: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
} as const

function StatCard({
  to,
  icon,
  count,
  label,
  tone,
}: {
  to: string
  icon: React.ReactNode
  count: number
  label: string
  tone: keyof typeof TONES
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <div className="flex items-center gap-2">
        <span className={count === 0 ? 'text-muted-foreground' : TONES[tone]}>{icon}</span>
        <span className="text-2xl font-semibold tabular-nums">{count}</span>
      </div>
      <p className="mt-1 text-sm font-medium">{label}</p>
    </Link>
  )
}
