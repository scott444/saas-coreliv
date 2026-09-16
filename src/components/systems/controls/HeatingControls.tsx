import { Minus, Plus } from 'lucide-react'
import type { HeatingCommand, HeatingMode, HeatingState } from '@/domain'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { formatTemp } from '@/lib/format'
import { ModeSelector } from './ModeSelector'

export interface HeatingControlsProps {
  state: HeatingState
  disabled?: boolean
  onCommand(command: HeatingCommand): void
}

const MODES: HeatingMode[] = ['Heat', 'Auto', 'Off']
const MIN = 5
const MAX = 30

export function HeatingControls({ state, disabled = false, onCommand }: HeatingControlsProps) {
  const setTarget = (targetTemp: number) => {
    const clamped = Math.min(MAX, Math.max(MIN, Math.round(targetTemp * 2) / 2))
    if (clamped !== state.targetTemp) onCommand({ type: 'Heating', action: 'setTargetTemp', targetTemp: clamped })
  }
  const targetDisabled = disabled || state.mode === 'Off'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Current" value={formatTemp(state.currentTemp)} />
        <Stat label="Humidity" value={`${state.humidity}%`} />
        <Stat label="Status" value={state.isHeating ? 'Heating' : state.mode === 'Off' ? 'Off' : 'Idle'} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Target temperature</span>
          <span className="text-sm text-muted-foreground" data-testid="heating-target">
            {state.targetTemp}°C
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" aria-label="Decrease target" disabled={targetDisabled || state.targetTemp <= MIN} onClick={() => setTarget(state.targetTemp - 0.5)}>
            <Minus />
          </Button>
          <Slider
            aria-label="Target temperature"
            min={MIN}
            max={MAX}
            step={0.5}
            value={[state.targetTemp]}
            disabled={targetDisabled}
            onValueCommit={(v) => setTarget(v[0] ?? state.targetTemp)}
          />
          <Button variant="outline" size="icon" aria-label="Increase target" disabled={targetDisabled || state.targetTemp >= MAX} onClick={() => setTarget(state.targetTemp + 0.5)}>
            <Plus />
          </Button>
        </div>
      </div>

      <ModeSelector label="Mode" options={MODES} value={state.mode} disabled={disabled} onChange={(mode) => onCommand({ type: 'Heating', action: 'setMode', mode })} />
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
