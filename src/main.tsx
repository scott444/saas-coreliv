import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { createServices } from './services'
import './index.css'

async function bootstrap() {
  const mode = import.meta.env.VITE_DATA_MODE ?? 'mock'

  if (mode === 'mock') {
    // Only pull MSW into the bundle when we actually mock.
    const { startMockWorker } = await import('./mocks/browser')
    await startMockWorker()
  }

  const services = createServices({ mode })

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App services={services} />
    </React.StrictMode>,
  )
}

void bootstrap()
