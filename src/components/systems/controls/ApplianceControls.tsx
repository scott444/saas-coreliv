import { useState } from 'react'
import { Play, Power, X } from 'lucide-react'
import type { ApplianceCommand, ApplianceState } from '@/domain'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Stat } from './HeatingControls'

export interface ApplianceControlsProps {
  state: ApplianceState
  disabled?: boolean
  onCommand(command: ApplianceCommand): void
}

export function ApplianceControls({ state, disabled = false, onCommand }: ApplianceControlsProps) {
  const cycles = state.availableCycles
  const [selectedCycle, setSelectedCycle] = useState<string>(cycles[0] ?? '')
  const isOn = state.powerState !== 'Off'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Power" value={state.powerState} />
        <Stat label="Draw" value={`${state.powerDrawWatts} W`} />
        <Stat label="Cycle" value={state.cycle ?? 'None'} />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Power className="size-4 text-muted-foreground" />
          <Label htmlFor="appliance-power" className="cursor-pointer">
            Power
          </Label>
        </div>
        <Switch
          id="appliance-power"
          checked={isOn}
          disabled={disabled}
          aria-label="Power"
          onCheckedChange={(checked) => onCommand({ type: 'Appliance', action: 'setPower', powerState: checked ? 'On' : 'Off' })}
        />
      </div>

      {state.cycle ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{state.cycle}</p>
              <p className="text-xs text-muted-foreground">{state.remainingMinutes === null ? 'Starting…' : `${state.remainingMinutes} min remaining`}</p>
            </div>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => onCommand({ type: 'Appliance', action: 'cancelCycle' })}>
              <X /> Cancel
            </Button>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={state.cycleProgress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${state.cycleProgress}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="appliance-cycle">Cycle</Label>
            <Select value={selectedCycle} onValueChange={setSelectedCycle} disabled={disabled || cycles.length === 0}>
              <SelectTrigger id="appliance-cycle" aria-label="Cycle">
                <SelectValue placeholder="Choose a cycle" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={disabled || !selectedCycle} onClick={() => onCommand({ type: 'Appliance', action: 'startCycle', cycle: selectedCycle })}>
            <Play /> Start
          </Button>
        </div>
      )}
    </div>
  )
}
