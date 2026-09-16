import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HeatingState } from '@/domain'
import { HeatingControls } from './HeatingControls'

const state: HeatingState = { type: 'Heating', currentTemp: 20.4, targetTemp: 21, mode: 'Auto', isHeating: true, humidity: 43 }

describe('HeatingControls', () => {
  it('renders the live state', () => {
    render(<HeatingControls state={state} onCommand={vi.fn()} />)
    expect(screen.getByText('20.4°C')).toBeInTheDocument()
    expect(screen.getByTestId('heating-target')).toHaveTextContent('21°C')
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked()
  })

  it('emits a setTargetTemp command in half-degree steps', async () => {
    const onCommand = vi.fn()
    render(<HeatingControls state={state} onCommand={onCommand} />)
    await userEvent.click(screen.getByRole('button', { name: 'Increase target' }))
    expect(onCommand).toHaveBeenCalledWith({ type: 'Heating', action: 'setTargetTemp', targetTemp: 21.5 })
    await userEvent.click(screen.getByRole('button', { name: 'Decrease target' }))
    expect(onCommand).toHaveBeenCalledWith({ type: 'Heating', action: 'setTargetTemp', targetTemp: 20.5 })
  })

  it('emits a setMode command and ignores clicks on the active mode', async () => {
    const onCommand = vi.fn()
    render(<HeatingControls state={state} onCommand={onCommand} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Off' }))
    expect(onCommand).toHaveBeenCalledWith({ type: 'Heating', action: 'setMode', mode: 'Off' })
    await userEvent.click(screen.getByRole('radio', { name: 'Auto' }))
    expect(onCommand).toHaveBeenCalledTimes(1)
  })

  it('locks the target when the system is off or disabled', () => {
    const { rerender } = render(<HeatingControls state={{ ...state, mode: 'Off' }} onCommand={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Increase target' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Heat' })).toBeEnabled()

    rerender(<HeatingControls state={state} disabled onCommand={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Increase target' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Heat' })).toBeDisabled()
  })
})
