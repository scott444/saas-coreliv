import type { Services } from '../types'
import type { ApiClient } from '../apiClient'
import { createHttpAuthService } from './authService'
import { createHttpOrganizationService } from './organizationService'
import { createHttpBillingService } from './billingService'
import { createHttpPropertiesService } from './propertiesService'
import { createHttpAssetsService } from './assetsService'
import { createHttpMaintenanceService } from './maintenanceService'
import { createHttpVendorsService } from './vendorsService'
import { createHttpDocumentsService } from './documentsService'

/**
 * The app's own API, in `server/`.
 *
 * Each service is a thin translation from an interface method to a REST call;
 * anything that needs joining or deriving happens on the server, so nothing
 * here does more than name a URL.
 */
export function createHttpServices(client: ApiClient): Services {
  return {
    auth: createHttpAuthService(client),
    organizations: createHttpOrganizationService(client),
    billing: createHttpBillingService(client),
    properties: createHttpPropertiesService(client),
    assets: createHttpAssetsService(client),
    maintenance: createHttpMaintenanceService(client),
    vendors: createHttpVendorsService(client),
    documents: createHttpDocumentsService(client),
  }
}
