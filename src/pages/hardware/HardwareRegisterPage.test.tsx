import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgProvider, useOrg } from '@/app/OrgProvider'
import { createTestServices, renderWithProviders } from '@/test/render'
import { HardwareRegisterPage } from './HardwareRegisterPage'

/** Mirrors the AppShell: the page only mounts once an organization is selected. */
function WhenOrgReady() {
  const { currentOrg } = useOrg()
  return currentOrg ? <HardwareRegisterPage /> : <p>loading org</p>
}

/** The seeded org: 7 systems across 2 homes, 6 of them documented. */
async function renderRegister() {
  const services = createTestServices()
  await services.auth.login('ava@coreliv.dev', 'password') // the org endpoints require a bearer token
  const result = renderWithProviders(
    <OrgProvider>
      <WhenOrgReady />
    </OrgProvider>,
    { services },
  )
  await screen.findByRole('table')
  return result
}

function rowNames(): string[] {
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1) // drop the header
  return rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '')
}

function tile(label: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(label) })
}

describe('HardwareRegisterPage (connected via mock service + MSW)', () => {
  it('lists every system in the org, documented or not', async () => {
    await renderRegister()

    expect(rowNames()).toHaveLength(7)
    expect(screen.getByText('Nibe')).toBeInTheDocument()
    expect(screen.getByText('NB-06621-448713')).toBeInTheDocument()
    expect(screen.getByText('Showing 7 of 7 devices')).toBeInTheDocument()
  })

  it('summarises the whole register', async () => {
    await renderRegister()

    expect(tile('Devices')).toHaveTextContent('7')
    // Only the tumble dryer has no record.
    expect(tile('Missing details')).toHaveTextContent('1')
    expect(tile('Expiring soon')).toHaveTextContent('1')
    expect(tile('Out of warranty')).toHaveTextContent('1')
  })

  it('offers a way in for a system with no record', async () => {
    await renderRegister()

    const dryerRow = screen.getByText('Tumble dryer').closest('tr') as HTMLElement
    expect(within(dryerRow).getByRole('link', { name: 'Add details' })).toHaveAttribute('href', '/systems/sys-city-dryer')
    // An undocumented system has no warranty claim to make either way.
    expect(within(dryerRow).queryByText(/warranty|No end date/i)).not.toBeInTheDocument()
  })

  it('distinguishes a missing warranty date from a missing record', async () => {
    await renderRegister()

    // The irrigation controller is documented but has no warranty end recorded.
    const irrigationRow = screen.getByText('Garden irrigation').closest('tr') as HTMLElement
    expect(within(irrigationRow).getByText('No end date')).toBeInTheDocument()
  })

  it('narrows to undocumented devices when the tile is pressed', async () => {
    await renderRegister()

    await userEvent.click(tile('Missing details'))
    await waitFor(() => expect(rowNames()).toHaveLength(1))
    expect(rowNames()[0]).toContain('Tumble dryer')
    expect(tile('Missing details')).toHaveAttribute('aria-pressed', 'true')

    // Pressing the active tile again clears it rather than trapping the view.
    await userEvent.click(tile('Missing details'))
    await waitFor(() => expect(rowNames()).toHaveLength(7))
  })

  it('searches across manufacturer, model and serial', async () => {
    await renderRegister()
    const search = screen.getByLabelText('Search')

    await userEvent.type(search, 'harvia')
    await waitFor(() => expect(rowNames()).toHaveLength(1))
    expect(rowNames()[0]).toContain('Sauna heater')

    await userEvent.clear(search)
    await userEvent.type(search, 'DF-ALLY-553102')
    await waitFor(() => expect(rowNames()).toHaveLength(1))
    expect(rowNames()[0]).toContain('Radiator controller')
  })

  it('explains an empty result instead of showing a bare table', async () => {
    await renderRegister()

    await userEvent.type(screen.getByLabelText('Search'), 'nothing matches this')
    expect(await screen.findByText('Nothing matches those filters')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 0 of 7 devices')).toBeInTheDocument()
  })

  // Home filtering is covered by registerFilter.test.ts rather than here: opening
  // a Radix select in jsdom costs ~14s, which is not worth paying in this suite.
  it('defaults the home filter to all homes', async () => {
    await renderRegister()
    expect(screen.getByLabelText('Home')).toHaveTextContent('All homes')
  })
})
