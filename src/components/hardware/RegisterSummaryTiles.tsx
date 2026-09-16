import type { RegisterSummary } from '@/domain'
import type { RegisterFocus } from './registerFilter'
import { cn } from '@/lib/utils'

interface Tile {
  focus: RegisterFocus
  label: string
  count: (summary: RegisterSummary) => number
  /** Tint applied only when the count is non-zero - a zero needs no alarm. */
  tone?: string
}

const TILES: Tile[] = [
  { focus: 'all', label: 'Devices', count: (s) => s.total },
  { focus: 'missing', label: 'Missing details', count: (s) => s.missing, tone: 'text-muted-foreground' },
  { focus: 'expiring', label: 'Expiring soon', count: (s) => s.expiringSoon, tone: 'text-warning' },
  { focus: 'expired', label: 'Out of warranty', count: (s) => s.expired, tone: 'text-destructive' },
]

/**
 * Doubles as the register's filter control: the counts are the questions people
 * come to this page with, so clicking one narrows the table to those rows.
 */
export function RegisterSummaryTiles({
  summary,
  focus,
  onFocusChange,
}: {
  summary: RegisterSummary
  focus: RegisterFocus
  onFocusChange(focus: RegisterFocus): void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((tile) => {
        const count = tile.count(summary)
        const active = focus === tile.focus
        return (
          <button
            key={tile.focus}
            type="button"
            aria-pressed={active}
            // Clicking the active tile clears it rather than trapping the view.
            onClick={() => onFocusChange(active && tile.focus !== 'all' ? 'all' : tile.focus)}
            className={cn(
              'rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active && 'border-primary ring-1 ring-primary',
            )}
          >
            <p className={cn('text-2xl font-semibold tabular-nums', count > 0 && tile.tone)}>{count}</p>
            <p className="text-sm text-muted-foreground">{tile.label}</p>
          </button>
        )
      })}
    </div>
  )
}
