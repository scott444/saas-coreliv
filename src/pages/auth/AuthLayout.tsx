import type { ReactNode } from 'react'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 32 32" className="size-5" fill="currentColor" aria-hidden>
              <path d="M8 18l8-8 8 8v6H8z" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">Coreliv</span>
        </div>
        <div className="max-w-md space-y-3">
          <h2 className="text-3xl font-semibold leading-tight">Every system in every home, one calm dashboard.</h2>
          <p className="text-sidebar-muted">Heating, cooling, irrigation and appliances, with live state, history and controls that stay out of your way.</p>
        </div>
        <p className="text-xs text-sidebar-muted">Preview build · placeholder data</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
