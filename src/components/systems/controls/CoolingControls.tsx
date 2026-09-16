import { Minus, Plus } from 'lucide-react'
import type { CoolingCommand, CoolingMode, CoolingState, FanSpeed } from '@/domain'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { formatTemp } from '@/lib/format'
import { ModeSelector } from './ModeSelector'
import { Stat } from './HeatingControls'

export interface CoolingControlsProps {
  state: CoolingState
  disabled?: boolean
  onCommand(command: CoolingCommand): void
}

const MODES: CoolingMode[] = ['Cool', 'Auto', 'Off']
const FAN_SPEEDS: FanSpeed[] = ['Auto', 'Low', 'Medium', 'High']
const MIN = 16
const MAX = 30

export function CoolingControls({ state, disabled = false, onCommand }: CoolingControlsProps) {
  const setTarget = (targetTemp: number) => {
    const clamped = Math.min(MAX, Math.max(MIN, Math.round(targetTemp * 2) / 2))
    if (clamped !== state.targetTemp) onCommand({ type: 'Cooling', action: 'setTargetTemp', targetTemp: clamped })
  }
  const targetDisabled = disabled || state.mode === 'Off'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Current" value={formatTemp(state.currentTemp)} />
        <Stat label="Fan" value={state.fanSpeed} />
        <Stat label="Status" value={state.isCooling ? 'Cooling' : state.mode === 'Off' ? 'Off' : 'Idle'} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Target temperature</span>
          <span className="text-sm text-muted-foreground" data-testid="cooling-target">
            {state.targetTemp}°C
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" aria-label="Decrease target" disabled={targetDisabled || state.targetTemp <= MIN} onClick={() => setTarget(state.targetTemp - 0.5)}>
            <Minus />
          </Button>
          <Slider aria-label="Target temperature" min={MIN} max={MAX} step={0.5} value={[state.targetTemp]} disabled={targetDisabled} onValueCommit={(v) => setTarget(v[0] ?? state.targetTemp)} />
          <Button variant="outline" size="icon" aria-label="Increase target" disabled={targetDisabled || state.targetTemp >= MAX} onClick={() => setTarget(state.targetTemp + 0.5)}>
            <Plus />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <ModeSelector label="Mode" options={MODES} value={state.mode} disabled={disabled} onChange={(mode) => onCommand({ type: 'Cooling', action: 'setMode', mode })} />
        <ModeSelector
          label="Fan speed"
          options={FAN_SPEEDS}
          value={state.fanSpeed}
          disabled={disabled || state.mode === 'Off'}
          onChange={(fanSpeed) => onCommand({ type: 'Cooling', action: 'setFanSpeed', fanSpeed })}
        />
      </div>
    </div>
  )
}
