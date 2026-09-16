import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/** Starts MSW in the browser. Only called when VITE_DATA_MODE=mock (see main.tsx). */
export async function startMockWorker(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}
