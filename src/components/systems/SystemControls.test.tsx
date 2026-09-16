import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HomeSystem, SystemState } from '@/domain'
import { ServiceError } from '@/services'
import { queryKeys } from '@/app/queryKeys'
import { useSystemState } from '@/hooks/useSystems'
import { renderWithProviders } from '@/test/render'
import { createFakeServices, createFakeWorld } from '@/test/fakeServices'
import { SystemControls } from './SystemControls'

const system: HomeSystem = { id: 's1', homeId: 'h1', type: 'Heating', name: 'Fake Boiler', status: 'Online' }
const stateKey = queryKeys.systems.state('s1')

/** Reads state through the query hook so optimistic cache writes re-render the controls, as in the app. */
function Harness() {
  const state = useSystemState('s1', { live: false })
  if (!state.data) return <p>loading</p>
  return <SystemControls system={system} state={state.data} />
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

describe('SystemControls (connected, optimistic)', () => {
  it('applies the command optimistically and keeps the server state on success', async () => {
    const world = createFakeWorld()
    const { queryClient } = renderWithProviders(<Harness />, { services: createFakeServices(world) })
    await screen.findByTestId('heating-target')

    await userEvent.click(screen.getByRole('button', { name: 'Increase target' }))

    await waitFor(() => expect(screen.getByTestId('heating-target')).toHaveTextContent('21.5°C'))
    expect(queryClient.getQueryData<SystemState>(stateKey)).toMatchObject({ targetTemp: 21.5 })
    expect(world.states.s1).toMatchObject({ targetTemp: 21.5 })
  })

  it('rolls back to the previous state and surfaces the error when the device rejects the command', async () => {
    const gate = deferred()
    const world = createFakeWorld({
      rejectCommand: () => new ServiceError('command_failed', 'Valve did not respond', 409),
    })
    const services = createFakeServices(world)
    // Hold the rejection until the optimistic state has been observed.
    const original = services.homeSystems.sendCommand
    services.homeSystems.sendCommand = async (id, cmd) => {
      await gate.promise
      return original(id, cmd)
    }

    const { queryClient } = renderWithProviders(<Harness />, { services })
    await screen.findByTestId('heating-target')

    await userEvent.click(screen.getByRole('button', { name: 'Increase target' }))

    // Optimistic: UI and cache show the new target before the server answers.
    await waitFor(() => expect(screen.getByTestId('heating-target')).toHaveTextContent('21.5°C'))
    expect(queryClient.getQueryData<SystemState>(stateKey)).toMatchObject({ targetTemp: 21.5 })

    gate.resolve()

    // Rollback: previous target restored and the failure is announced.
    await waitFor(() => expect(screen.getByTestId('heating-target')).toHaveTextContent('21°C'))
    expect(queryClient.getQueryData<SystemState>(stateKey)).toMatchObject({ targetTemp: 21 })
    expect(await screen.findByText('Command failed')).toBeInTheDocument()
    expect(screen.getByText('Valve did not respond')).toBeInTheDocument()
    expect(world.states.s1).toMatchObject({ targetTemp: 21 })
  })
})
