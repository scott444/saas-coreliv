import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Services } from '@/services'
import { ServiceError } from '@/services'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ToastProvider } from '@/components/ui/toast'
import { ServicesProvider } from './ServicesProvider'
import { AuthProvider } from './AuthProvider'
import { ThemeProvider } from './ThemeProvider'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          // Don't hammer endpoints that failed for a known, non-transient reason.
          if (ServiceError.is(error) && ['unauthorized', 'not_found', 'device_offline', 'validation'].includes(error.code)) {
            return false
          }
          return failureCount < 2
        },
      },
      mutations: { retry: false },
    },
  })
}

interface AppProvidersProps {
  services: Services
  queryClient?: QueryClient
  children: ReactNode
}

export function AppProviders({ services, queryClient, children }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <QueryClientProvider client={client}>
      <ServicesProvider services={services}>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </ServicesProvider>
    </QueryClientProvider>
  )
}
