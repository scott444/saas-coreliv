import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { OrgProvider, useOrg } from '@/app/OrgProvider'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { createTestServices, renderWithProviders } from './render'
import { createFakeServices, createFakeWorld } from './fakeServices'

/** Mirrors the AppShell: pages only mount once an organization is selected. */
function Dashboard() {
  const { currentOrg } = useOrg()
  return currentOrg ? <DashboardPage /> : <p>loading org</p>
}

/**
 * Proves the UI depends only on the service interfaces: the whole dashboard renders
 * against a hand-written in-memory implementation with fetch completely disabled.
 */
describe('service interface boundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders the dashboard from a swapped-in service implementation without any network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch must not be called when services are swapped')
    })

    const world = createFakeWorld()
    renderWithProviders(
      <OrgProvider>
        <Dashboard />
      </OrgProvider>,
      { services: createFakeServices(world) },
    )

    expect(await screen.findByRole('heading', { name: 'Test Cabin' })).toBeInTheDocument()
    expect(await screen.findByText('Fake Boiler')).toBeInTheDocument()
    expect(await screen.findByText('18.0°C')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders the same dashboard from the MSW-backed mock services', async () => {
    const services = createTestServices()
    await services.auth.login('ava@coreliv.dev', 'password') // the org endpoints require a bearer token
    renderWithProviders(
      <OrgProvider>
        <Dashboard />
      </OrgProvider>,
      { services },
    )

    expect(await screen.findByRole('heading', { name: 'Lake House' })).toBeInTheDocument()
    expect(await screen.findByText('Ground-floor heat pump')).toBeInTheDocument()
    // The offline dryer renders its unavailable state instead of fetching state.
    expect(await screen.findByText('Device is offline. Live state unavailable.')).toBeInTheDocument()
  })
})
