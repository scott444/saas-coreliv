import type { HomeSystem, SystemCommand, SystemState } from '@/domain'
import { useSendCommand } from '@/hooks/useSystems'
import { useToast } from '@/components/ui/toast'
import { HeatingControls } from './controls/HeatingControls'
import { CoolingControls } from './controls/CoolingControls'
import { IrrigationControls } from './controls/IrrigationControls'
import { ApplianceControls } from './controls/ApplianceControls'

interface SystemControlsProps {
  system: HomeSystem
  state: SystemState
  /** Extra reason to disable controls, e.g. an expired subscription. */
  disabled?: boolean
}

/**
 * Connected wrapper: picks the right control surface for the system type and
 * routes commands through the optimistic mutation. Presentational controls
 * underneath stay free of data-layer concerns.
 */
export function SystemControls({ system, state, disabled = false }: SystemControlsProps) {
  const { toast } = useToast()
  const send = useSendCommand(system.id, {
    onError: (error) => toast({ title: 'Command failed', description: error.message, variant: 'error' }),
  })

  const onCommand = (command: SystemCommand) => send.mutate(command)
  const controlsDisabled = disabled || system.status !== 'Online'

  switch (state.type) {
    case 'Heating':
      return <HeatingControls state={state} disabled={controlsDisabled} onCommand={onCommand} />
    case 'Cooling':
      return <CoolingControls state={state} disabled={controlsDisabled} onCommand={onCommand} />
    case 'Irrigation':
      return <IrrigationControls state={state} disabled={controlsDisabled} onCommand={onCommand} />
    case 'Appliance':
      return <ApplianceControls state={state} disabled={controlsDisabled} onCommand={onCommand} />
  }
}
