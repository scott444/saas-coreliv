import { cn } from '@/lib/utils'

interface ModeSelectorProps<T extends string> {
  label: string
  options: readonly T[]
  value: T
  disabled?: boolean
  onChange(value: T): void
}

/** Segmented control used for mode / fan speed style choices. */
export function ModeSelector<T extends string>({ label, options, value, disabled, onChange }: ModeSelectorProps<T>) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg bg-muted p-1 sm:w-auto">
        {options.map((option) => {
          const active = option === value
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => !active && onChange(option)}
              className={cn(
                'flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none',
                active ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
