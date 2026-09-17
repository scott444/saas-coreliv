import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { OrgProvider, useOrg } from '@/app/OrgProvider'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { AssetsPage } from '@/pages/assets/AssetsPage'
import { renderWithProviders } from './render'
import { createFakeServices } from './fakeServices'

/** Mirrors the AppShell: pages only mount once an organization is selected. */
function WithOrg({ children }: { children: React.ReactNode }) {
  const { currentOrg } = useOrg()
  return currentOrg ? <>{children}</> : <p>loading org</p>
}

/**
 * Proves the UI depends only on the service interfaces.
 *
 * Both pages render against a hand-written in-memory implementation with
 * `fetch` thrown from, so anything that reached past the interfaces to a URL,
 * a header, or the shape of a REST response fails here.
 */
describe('service interface boundary', () => {
  afterEach(() => vi.restoreAllMocks())

  function disableFetch() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch must not be called when services are swapped')
    })
  }

  it('renders the dashboard from a swapped-in implementation with no network calls', async () => {
    const fetchSpy = disableFetch()

    renderWithProviders(
      <OrgProvider>
        <WithOrg>
          <DashboardPage />
        </WithOrg>
      </OrgProvider>,
      { services: createFakeServices() },
    )

    expect(await screen.findByRole('heading', { name: /Hello, Dana/ })).toBeInTheDocument()
    // The overdue air filter from the fake, rendered through the due table.
    expect(await screen.findByText('Air filter')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders the register from the same implementation', async () => {
    const fetchSpy = disableFetch()

    renderWithProviders(
      <OrgProvider>
        <WithOrg>
          <AssetsPage />
        </WithOrg>
      </OrgProvider>,
      { services: createFakeServices() },
    )

    expect(await screen.findByRole('link', { name: 'Furnace' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Water heater' })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
