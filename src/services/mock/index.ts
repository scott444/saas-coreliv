import type { Services } from '../types'
import type { ApiClient } from '../apiClient'
import { createMockAuthService } from './authService'
import { createMockOrganizationService } from './organizationService'
import { createMockBillingService } from './billingService'
import { createMockHomeSystemsService } from './homeSystemsService'

/**
 * Mock services call the same REST contract (/api/...) as the future http layer.
 * Requests are intercepted by MSW (see src/mocks/handlers.ts), which adds latency and
 * error cases, so the UI exercises real async/error paths in dev and tests.
 */
export function createMockServices(client: ApiClient): Services {
  return {
    auth: createMockAuthService(client),
    organizations: createMockOrganizationService(client),
    billing: createMockBillingService(client),
    homeSystems: createMockHomeSystemsService(client),
  }
}

export { createMockAuthService, createMockOrganizationService, createMockBillingService, createMockHomeSystemsService }
