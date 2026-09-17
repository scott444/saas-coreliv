import type { Services } from './types'
import { ApiClient } from './apiClient'
import { tokenStore } from './tokenStore'
import { createHttpServices } from './http'

export interface CreateServicesOptions {
  baseUrl?: string
}

/**
 * Single composition point for the data layer.
 *
 * There is one implementation now that the API lives in this repo. The seam
 * stays because it is what lets tests swap in `src/test/fakeServices.ts` and
 * render the whole app with `fetch` disabled - see `serviceBoundary.test.tsx`.
 *
 * `/api` is same-origin in every environment: the Vite dev server proxies it
 * (`vite.config.ts`), and nginx proxies it in the container.
 */
export function createServices(options: CreateServicesOptions = {}): Services {
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api'
  const client = new ApiClient({ baseUrl, getToken: () => tokenStore.get() })
  return createHttpServices(client)
}
