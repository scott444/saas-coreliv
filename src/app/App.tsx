import { RouterProvider } from 'react-router-dom'
import type { Services } from '@/services'
import { AppProviders } from './providers'
import { router } from './router'

export function App({ services }: { services: Services }) {
  return (
    <AppProviders services={services}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
