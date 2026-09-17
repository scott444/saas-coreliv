import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX, Infinity as InfinityIcon } from 'lucide-react'
import type { AssetStatus, DueStatus, WarrantySummary, WarrantyState } from '@/domain'
import { ASSET_STATUS_LABELS, DUE_STATUS_LABELS } from '@/domain'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * `unknown` reads differently from `expired` on purpose.
 *
 * No warranty recorded is a gap in the paperwork; an expired one is a gap in
 * cover. They want different follow-up, so they never share a colour - the
 * undocumented case stays neutral rather than borrowing the alarm of a real
 * lapse.
 */
const WARRANTY_STYLES: Record<WarrantyState, { className: string; Icon: typeof ShieldCheck }> = {
  lifetime: { className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', Icon: InfinityIcon },
  active: { className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', Icon: ShieldCheck },
  expiring: { className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400', Icon: ShieldAlert },
  expired: { className: 'border-destructive/30 bg-destructive/10 text-destructive', Icon: ShieldX },
  unknown: { className: 'border-border bg-muted text-muted-foreground', Icon: ShieldQuestion },
}

function warrantyText(summary: WarrantySummary): string {
  switch (summary.state) {
    case 'lifetime':
      return 'Lifetime'
    case 'unknown':
      return 'Not recorded'
    case 'expired': {
      const days = Math.abs(summary.daysRemaining ?? 0)
      return days === 0 ? 'Expired today' : `Expired ${formatDayCount(days)} ago`
    }
    case 'expiring':
      return `${formatDayCount(summary.daysRemaining ?? 0)} left`
    case 'active':
      return `${formatDayCount(summary.daysRemaining ?? 0)} left`
  }
}

/** Days become months and then years once the precision stops meaning anything. */
function formatDayCount(days: number): string {
  if (days < 45) return `${days} d`
  const months = Math.round(days / 30)
  if (months < 18) return `${months} mo`
  return `${Math.round(days / 365)} yr`
}

export function WarrantyBadge({
  summary,
  className,
}: {
  summary: WarrantySummary
  className?: string
}) {
  const { className: tone, Icon } = WARRANTY_STYLES[summary.state]
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', tone, className)}>
      <Icon className="size-3" />
      {warrantyText(summary)}
    </Badge>
  )
}

const ASSET_STATUS_STYLES: Record<AssetStatus, string> = {
  active: 'border-border bg-muted text-muted-foreground',
  needs_repair: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  retired: 'border-border bg-muted text-muted-foreground line-through',
  replaced: 'border-border bg-muted text-muted-foreground',
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  // `active` is the overwhelming majority, so it earns no badge at all -
  // a label on every row is noise that hides the two that matter.
  if (status === 'active') return null
  return (
    <Badge variant="outline" className={cn('font-medium', ASSET_STATUS_STYLES[status])}>
      {ASSET_STATUS_LABELS[status]}
    </Badge>
  )
}

const DUE_STYLES: Record<DueStatus, string> = {
  overdue: 'border-destructive/30 bg-destructive/10 text-destructive',
  due: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  soon: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  upcoming: 'border-border bg-muted text-muted-foreground',
  unscheduled: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
}

export function DueBadge({ status, days }: { status: DueStatus; days: number | null }) {
  const label =
    status === 'overdue' && days !== null
      ? `${formatDayCount(Math.abs(days))} overdue`
      : status === 'soon' && days !== null
        ? `In ${formatDayCount(days)}`
        : DUE_STATUS_LABELS[status]

  return (
    <Badge variant="outline" className={cn('font-medium', DUE_STYLES[status])}>
      {label}
    </Badge>
  )
}
