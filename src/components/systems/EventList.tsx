import { AlertTriangle, Info, XCircle } from 'lucide-react'
import type { SystemEvent } from '@/domain'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

export function EventList({ events }: { events: SystemEvent[] }) {
  return (
    <ol className="divide-y">
      {events.map((event) => {
        const Icon = event.severity === 'error' ? XCircle : event.severity === 'warning' ? AlertTriangle : Info
        return (
          <li key={event.id} className="flex items-start gap-3 py-3 text-sm">
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                event.severity === 'error' ? 'text-destructive' : event.severity === 'warning' ? 'text-warning' : 'text-muted-foreground',
              )}
            />
            <p className="flex-1">{event.message}</p>
            <time dateTime={event.timestamp} className="shrink-0 text-xs text-muted-foreground">
              {formatRelative(event.timestamp)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
