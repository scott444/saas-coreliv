import { CircleAlert, FileQuestion, ShieldAlert, ShieldX, Wrench } from 'lucide-react'
import type { RegisterSummary, RegisterTile } from './registerFilter'
import { cn } from '@/lib/utils'

interface Tile {
  key: RegisterTile
  label: string
  hint: string
  icon: typeof ShieldAlert
  tone: string
}

const TILES: Tile[] = [
  {
    key: 'overdue',
    label: 'Work overdue',
    hint: 'Filters or tasks past their date',
    icon: CircleAlert,
    tone: 'text-destructive',
  },
  {
    key: 'needsRepair',
    label: 'Needs repair',
    hint: 'Flagged as not working properly',
    icon: Wrench,
    tone: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'expiring',
    label: 'Cover expiring',
    hint: 'Warranty ends within 60 days',
    icon: ShieldAlert,
    tone: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'expired',
    label: 'Out of warranty',
    hint: 'Cover has lapsed',
    icon: ShieldX,
    tone: 'text-destructive',
  },
  {
    key: 'undocumented',
    label: 'No warranty recorded',
    hint: 'Nothing on file either way',
    icon: FileQuestion,
    tone: 'text-muted-foreground',
  },
]

/**
 * The tiles double as the filter control, which is why their counts always
 * describe the whole register rather than the current view - see `summarize`.
 */
export function RegisterSummaryTiles({
  summary,
  active,
  onSelect,
}: {
  summary: RegisterSummary
  active: RegisterTile | null
  onSelect: (tile: RegisterTile | null) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {TILES.map(({ key, label, hint, icon: Icon, tone }) => {
        const count = summary[key]
        const isActive = active === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : key)}
            title={hint}
            className={cn(
              'group rounded-xl border bg-card p-4 text-left transition-colors',
              'hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive && 'border-foreground/40 ring-1 ring-foreground/20',
              // Nothing to act on reads quieter than something that needs a look.
              count === 0 && !isActive && 'opacity-60',
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn('size-4', count === 0 ? 'text-muted-foreground' : tone)} />
              <span className="text-2xl font-semibold tabular-nums">{count}</span>
            </div>
            <p className="mt-1 text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </button>
        )
      })}
    </div>
  )
}
