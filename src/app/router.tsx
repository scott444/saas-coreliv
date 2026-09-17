import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { OrgProvider } from './OrgProvider'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingState } from '@/components/states'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { AssetsPage } from '@/pages/assets/AssetsPage'
import { AssetDetailPage } from '@/pages/assets/AssetDetailPage'
import { MaintenancePage } from '@/pages/maintenance/MaintenancePage'
import { PropertiesPage } from '@/pages/properties/PropertiesPage'
import { VendorsPage } from '@/pages/vendors/VendorsPage'
import { DocumentsPage } from '@/pages/documents/DocumentsPage'
import { OrganizationPage } from '@/pages/organization/OrganizationPage'
import { BillingPage } from '@/pages/billing/BillingPage'
import { BillingReturnPage } from '@/pages/billing/BillingReturnPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <LoadingState variant="page" className="max-w-2xl" />
    </div>
  )
}

/** Redirects unauthenticated users to /login, remembering where they were going. */
export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullScreenLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return (
    <OrgProvider>
      <Outlet />
    </OrgProvider>
  )
}

/** Sends signed-in users away from the auth pages. */
export function RedirectIfAuthed() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullScreenLoading />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

export const routes = [
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'assets', element: <AssetsPage /> },
          { path: 'assets/:assetId', element: <AssetDetailPage /> },
          { path: 'maintenance', element: <MaintenancePage /> },
          { path: 'documents', element: <DocumentsPage /> },
          { path: 'properties', element: <PropertiesPage /> },
          { path: 'vendors', element: <VendorsPage /> },
          { path: 'organization', element: <OrganizationPage /> },
          { path: 'billing', element: <BillingPage /> },
          { path: 'billing/return', element: <BillingReturnPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
