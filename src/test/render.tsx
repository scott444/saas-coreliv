import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Services } from '@/services'
import { ServicesProvider } from '@/app/ServicesProvider'
import { AuthProvider } from '@/app/AuthProvider'
import { createFakeServices } from './fakeServices'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ToastProvider } from '@/components/ui/toast'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
      mutations: { retry: false },
    },
  })
}

/**
 * Default services for tests: the hand-written in-memory fake.
 *
 * Component tests assert on what the UI does with data, not on how it is
 * fetched, so they go through the interfaces rather than a stubbed network.
 * The one test that does care about the wire - `apiClient.test.ts` - drives
 * ApiClient directly against a stubbed `fetch`.
 */
export function createTestServices(): Services {
  return createFakeServices()
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  services?: Services
  queryClient?: QueryClient
  route?: string
}

export function renderWithProviders(ui: ReactElement, { services, queryClient, route = '/', ...options }: Options = {}) {
  const client = queryClient ?? createTestQueryClient()
  const svc = services ?? createTestServices()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ServicesProvider services={svc}>
          <TooltipProvider>
            <ToastProvider>
              {/* Pages greet the signed-in user, so the auth context has to be
                  present even in tests that are not about authentication. */}
              <AuthProvider>
                <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
              </AuthProvider>
            </ToastProvider>
          </TooltipProvider>
        </ServicesProvider>
      </QueryClientProvider>
    )
  }

  return { queryClient: client, services: svc, ...render(ui, { wrapper: Wrapper, ...options }) }
}
