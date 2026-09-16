import { createContext, useContext, type ReactNode } from 'react'
import type { Services } from '@/services'

const ServicesContext = createContext<Services | null>(null)

interface ServicesProviderProps {
  services: Services
  children: ReactNode
}

/**
 * The only place the UI learns about a concrete data implementation.
 * Tests and storybook-style harnesses pass their own `services` object.
 */
export function ServicesProvider({ services, children }: ServicesProviderProps) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}

export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>')
  return services
}
