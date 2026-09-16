import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ServiceError } from '@/services'
import { errorMessage } from '@/lib/errorMessage'

interface LoadingStateProps {
  /** Visual shape of the placeholder */
  variant?: 'cards' | 'list' | 'page' | 'inline'
  count?: number
  className?: string
  label?: string
}

export function LoadingState({ variant = 'cards', count = 3, className, label = 'Loading' }: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, i) => i)
  return (
    <div role="status" aria-label={label} aria-busy="true" className={cn('w-full', className)}>
      {variant === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      )}
      {variant === 'list' && (
        <div className="space-y-2">
          {items.map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {variant === 'page' && (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
      {variant === 'inline' && <Skeleton className="h-5 w-24" />}
      <span className="sr-only">{label}…</span>
    </div>
  )
}

interface ErrorStateProps {
  error: unknown
  title?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorState({ error, title, onRetry, className, compact = false }: ErrorStateProps) {
  const isOffline = ServiceError.is(error) && error.code === 'device_offline'
  const Icon = isOffline ? WifiOff : AlertTriangle
  const heading = title ?? (isOffline ? 'Device offline' : 'Something went wrong')
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center',
        compact ? 'p-4' : 'p-10',
        className,
      )}
    >
      <div className={cn('flex items-center justify-center rounded-full bg-destructive/10 text-destructive', compact ? 'size-8' : 'size-12')}>
        <Icon className={compact ? 'size-4' : 'size-6'} />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{heading}</p>
        <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      ) : null}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon ?? <Inbox className="size-6" />}</div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
