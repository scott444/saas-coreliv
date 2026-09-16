import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sidebar } from './Sidebar'
import { OrgSwitcher } from './OrgSwitcher'
import { UserMenu } from './UserMenu'
import { BillingStatusBanner } from '@/components/billing/BillingStatusBanner'
import { useOrg } from '@/app/OrgProvider'
import { LoadingState, ErrorState, EmptyState } from '@/components/states'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { currentOrg, isLoading, error, refetch } = useOrg()

  useEffect(() => setMobileOpen(false), [location.pathname])

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-accent bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Navigation"
      >
        <div className="flex items-center justify-end p-2">
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X />
          </Button>
        </div>
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <OrgSwitcher />
          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {isLoading ? (
              <LoadingState variant="page" />
            ) : error ? (
              <ErrorState error={error} title="Could not load your organizations" onRetry={refetch} />
            ) : !currentOrg ? (
              <EmptyState title="No organization yet" description="You are not a member of any organization. Ask an owner to invite you." />
            ) : (
              <>
                <BillingStatusBanner orgId={currentOrg.id} />
                <Outlet />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
