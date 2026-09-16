import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Node-side MSW server for Vitest. */
export const server = setupServer(...handlers)
