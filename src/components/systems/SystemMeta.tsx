import { Droplets, Flame, Snowflake, WashingMachine } from 'lucide-react'
import type { SystemStatus, SystemType } from '@/domain'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ICONS = { Heating: Flame, Cooling: Snowflake, Irrigation: Droplets, Appliance: WashingMachine } as const
const TINTS: Record<SystemType, string> = {
  Heating: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  Cooling: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  Irrigation: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Appliance: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
}

export function SystemTypeIcon({ type, className }: { type: SystemType; className?: string }) {
  const Icon = ICONS[type]
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', TINTS[type], className)} aria-label={type}>
      <Icon className="size-5" />
    </span>
  )
}

export function SystemStatusBadge({ status }: { status: SystemStatus }) {
  const variant = status === 'Online' ? 'success' : status === 'Offline' ? 'muted' : 'destructive'
  return (
    <Badge variant={variant}>
      <span className={cn('size-1.5 rounded-full', status === 'Online' ? 'bg-success' : status === 'Offline' ? 'bg-muted-foreground' : 'bg-destructive')} />
      {status}
    </Badge>
  )
}
