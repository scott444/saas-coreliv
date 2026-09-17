import { NavLink } from 'react-router-dom'
import { CalendarCheck, CreditCard, FileText, Home, LayoutDashboard, Package, Users, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/assets', label: 'Register', icon: Package },
  { to: '/maintenance', label: 'Maintenance', icon: CalendarCheck },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/properties', label: 'Properties', icon: Home },
  { to: '/vendors', label: 'Vendors', icon: Wrench },
  { to: '/organization', label: 'Organization', icon: Users },
  { to: '/billing', label: 'Billing', icon: CreditCard },
] as const

export function Sidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <svg viewBox="0 0 32 32" className="size-4" fill="currentColor" aria-hidden>
            <path d="M8 18l8-8 8 8v6H8z" />
          </svg>
        </span>
        <span className="text-base font-semibold tracking-tight">Coreliv</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest ? rest.end : false}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-foreground'
                  : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-xs text-sidebar-muted">
        <p>Home asset record</p>
        <p className="opacity-70">Every warranty, filter and service visit</p>
      </div>
    </div>
  )
}
