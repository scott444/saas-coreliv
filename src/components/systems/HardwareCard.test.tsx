import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { HardwareCard } from './HardwareCard'

/** The dialog is portalled, so scope queries to it rather than the whole screen. */
async function openForm(name: RegExp) {
  await userEvent.click(await screen.findByRole('button', { name }))
  return within(await screen.findByRole('dialog'))
}

describe('HardwareCard (connected via mock service + MSW)', () => {
  it('shows the seeded record with its warranty state', async () => {
    renderWithProviders(<HardwareCard systemId="sys-lake-heat" />)

    expect(await screen.findByText('Nibe')).toBeInTheDocument()
    expect(screen.getByText('F1255-12 R')).toBeInTheDocument()
    expect(screen.getByText('NB-06621-448713')).toBeInTheDocument()
    expect(screen.getByText('Sigtuna VVS & Värme AB')).toBeInTheDocument()
    expect(screen.getByText('In warranty')).toBeInTheDocument()
  })

  it('marks a lapsed warranty as expired', async () => {
    renderWithProviders(<HardwareCard systemId="sys-lake-sauna" />)
    expect(await screen.findByText('Expired')).toBeInTheDocument()
  })

  it('labels fields the device never reported as not recorded', async () => {
    // The washing machine is seeded with no serial and no firmware.
    renderWithProviders(<HardwareCard systemId="sys-city-washer" />)

    expect(await screen.findByText('Miele')).toBeInTheDocument()
    const serial = screen.getByText('Serial number').closest('div')
    expect(within(serial as HTMLElement).getByText('Not recorded')).toBeInTheDocument()
  })

  it('records hardware for a system that has none', async () => {
    renderWithProviders(<HardwareCard systemId="sys-city-dryer" />)

    expect(await screen.findByText('No hardware recorded')).toBeInTheDocument()
    const form = await openForm(/Add hardware details/)

    await userEvent.type(form.getByLabelText(/Manufacturer/), 'Bosch')
    await userEvent.type(form.getByLabelText(/Model/), 'WTW87641')
    await userEvent.type(form.getByLabelText(/Serial number/), 'BSH-4471-0092')
    fireEvent.change(form.getByLabelText(/Install date/), { target: { value: '2025-03-04' } })
    await userEvent.click(form.getByRole('button', { name: 'Save details' }))

    expect(await screen.findByText('Bosch')).toBeInTheDocument()
    expect(screen.getByText('WTW87641')).toBeInTheDocument()
    expect(screen.getByText('BSH-4471-0092')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('edits an existing record', async () => {
    renderWithProviders(<HardwareCard systemId="sys-lake-cool" />)
    expect(await screen.findByText('2.4.1')).toBeInTheDocument()

    const form = await openForm(/Edit/)
    const firmware = form.getByLabelText(/Firmware version/)
    await userEvent.clear(firmware)
    await userEvent.type(firmware, '2.5.0')
    await userEvent.click(form.getByRole('button', { name: 'Save details' }))

    expect(await screen.findByText('2.5.0')).toBeInTheDocument()
  })

  it('blocks a warranty date that precedes the install date', async () => {
    renderWithProviders(<HardwareCard systemId="sys-city-dryer" />)
    const form = await openForm(/Add hardware details/)

    await userEvent.type(form.getByLabelText(/Manufacturer/), 'Bosch')
    await userEvent.type(form.getByLabelText(/Model/), 'WTW87641')
    fireEvent.change(form.getByLabelText(/Install date/), { target: { value: '2025-03-04' } })
    fireEvent.change(form.getByLabelText(/Warranty ends/), { target: { value: '2024-01-01' } })

    expect(form.getByRole('alert')).toHaveTextContent('Warranty cannot end before the install date')
    expect(form.getByRole('button', { name: 'Save details' })).toBeDisabled()
  })
})
