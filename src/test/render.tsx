import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Services } from '@/services'
import { createServices } from '@/services'
import { ServicesProvider } from '@/app/ServicesProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ToastProvider } from '@/components/ui/toast'

/** Node's fetch needs absolute URLs; MSW handlers match any origin. */
export const TEST_API_BASE = 'http://localhost/api'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
      mutations: { retry: false },
    },
  })
}

/** Default services for tests: the mock implementations talking to the MSW node server. */
export function createTestServices(): Services {
  return createServices({ mode: 'mock', baseUrl: TEST_API_BASE })
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
              <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </ToastProvider>
          </TooltipProvider>
        </ServicesProvider>
      </QueryClientProvider>
    )
  }

  return { queryClient: client, services: svc, ...render(ui, { wrapper: Wrapper, ...options }) }
}
