import type { DataMode, Services } from './types'
import { ApiClient } from './apiClient'
import { tokenStore } from './tokenStore'
import { createMockServices } from './mock'
import { createHttpServices } from './http'

export interface CreateServicesOptions {
  mode?: DataMode
  baseUrl?: string
}

/**
 * Single composition point for the data layer.
 * VITE_DATA_MODE=mock (default) talks to MSW-backed endpoints;
 * VITE_DATA_MODE=http talks to a real backend at VITE_API_BASE_URL.
 */
export function createServices(options: CreateServicesOptions = {}): Services {
  const mode = options.mode ?? import.meta.env.VITE_DATA_MODE ?? 'mock'
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api'
  const client = new ApiClient({ baseUrl, getToken: () => tokenStore.get() })

  switch (mode) {
    case 'http':
      return createHttpServices(client)
    case 'mock':
      return createMockServices(client)
    default: {
      const exhaustive: never = mode
      throw new Error('Unknown VITE_DATA_MODE: ' + String(exhaustive))
    }
  }
}
