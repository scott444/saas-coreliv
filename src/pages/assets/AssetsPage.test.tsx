import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgProvider, useOrg } from '@/app/OrgProvider'
import { renderWithProviders } from '@/test/render'
import { createFakeServices } from '@/test/fakeServices'
import { AssetsPage } from './AssetsPage'

function Page() {
  const { currentOrg } = useOrg()
  return currentOrg ? <AssetsPage /> : <p>loading</p>
}

async function renderRegister() {
  const user = userEvent.setup()
  renderWithProviders(
    <OrgProvider>
      <Page />
    </OrgProvider>,
    { services: createFakeServices() },
  )
  // The table is the signal that the register has loaded.
  await screen.findByRole('link', { name: 'Furnace' })
  return { user }
}

/** The tiles are the filter control, so they are driven, not just read. */
function tile(name: RegExp) {
  return screen.getByRole('button', { name })
}

describe('AssetsPage', () => {
  it('lists every asset with its make, model and warranty state', async () => {
    await renderRegister()

    expect(screen.getByRole('link', { name: 'Furnace' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Water heater' })).toBeInTheDocument()
    expect(screen.getByText(/Carrier 59TP6B080V17-20/)).toBeInTheDocument()
    expect(screen.getByText('2 assets')).toBeInTheDocument()
  })

  it('searches across make and serial, not just the name', async () => {
    const { user } = await renderRegister()
    const search = screen.getByLabelText('Search the register')

    await user.type(search, 'RH2178')

    expect(screen.getByRole('link', { name: 'Water heater' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Furnace' })).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2 assets')).toBeInTheDocument()
  })

  it('filters when a tile is pressed, and clears when it is pressed again', async () => {
    const { user } = await renderRegister()

    await user.click(tile(/Needs repair/))

    expect(screen.getByRole('link', { name: 'Water heater' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Furnace' })).not.toBeInTheDocument()
    expect(tile(/Needs repair/)).toHaveAttribute('aria-pressed', 'true')

    await user.click(tile(/Needs repair/))

    expect(screen.getByRole('link', { name: 'Furnace' })).toBeInTheDocument()
    expect(tile(/Needs repair/)).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps tile counts describing the whole register while a filter is applied', async () => {
    const { user } = await renderRegister()

    // The furnace's cover is expiring; the water heater has none recorded.
    const expiring = tile(/Cover expiring/)
    expect(within(expiring).getByText('1')).toBeInTheDocument()

    await user.click(tile(/No warranty recorded/))

    // Still 1, even though the expiring asset is no longer in the view - the
    // tiles have to keep showing what there is to filter to.
    expect(within(tile(/Cover expiring/)).getByText('1')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 assets')).toBeInTheDocument()
  })

  it('offers a way out when a filter matches nothing', async () => {
    const { user } = await renderRegister()

    await user.type(screen.getByLabelText('Search the register'), 'zzzz')

    expect(screen.getByText('Nothing matches')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('link', { name: 'Furnace' })).toBeInTheDocument()
  })
})
