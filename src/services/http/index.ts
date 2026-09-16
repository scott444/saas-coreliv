import type { Services } from '../types'
import type { ApiClient } from '../apiClient'
import { createHttpAuthService } from './authService'
import { createHttpOrganizationService } from './organizationService'
import { createHttpBillingService } from './billingService'
import { createHttpHomeSystemsService } from './homeSystemsService'

/**
 * Real backend implementations. Each service here mirrors its mock counterpart
 * and may diverge freely (different endpoints, SDKs, auth) without touching the UI.
 * See README "Adding an http implementation".
 */
export function createHttpServices(client: ApiClient): Services {
  return {
    auth: createHttpAuthService(client),
    organizations: createHttpOrganizationService(client),
    billing: createHttpBillingService(client),
    homeSystems: createHttpHomeSystemsService(client),
  }
}
