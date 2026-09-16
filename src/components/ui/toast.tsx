import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'default' | 'success' | 'error'

export interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  durationMs?: number
}

interface ToastItem extends Required<Omit<ToastInput, 'description'>> {
  id: number
  description?: string
}

interface ToastContextValue {
  toast(input: ToastInput): void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextToastId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (input: ToastInput) => {
      const item: ToastItem = {
        id: nextToastId++,
        title: input.title,
        description: input.description,
        variant: input.variant ?? 'default',
        durationMs: input.durationMs ?? 4500,
      }
      setToasts((t) => [...t, item])
      window.setTimeout(() => dismiss(item.id), item.durationMs)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3 text-sm shadow-lg',
              t.variant === 'error' && 'border-destructive/40',
              t.variant === 'success' && 'border-success/40',
            )}
          >
            {t.variant === 'error' ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : t.variant === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            )}
            <div className="flex-1">
              <p className="font-medium">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-muted-foreground">{t.description}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
