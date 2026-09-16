import { CloudRain, Play, Square } from 'lucide-react'
import type { IrrigationCommand, IrrigationState } from '@/domain'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Stat } from './HeatingControls'

export interface IrrigationControlsProps {
  state: IrrigationState
  disabled?: boolean
  onCommand(command: IrrigationCommand): void
}

const RAIN_DELAY_OPTIONS = [
  { value: 'none', label: 'No delay' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
] as const

export function IrrigationControls({ state, disabled = false, onCommand }: IrrigationControlsProps) {
  const running = state.zones.filter((z) => z.isRunning).length
  const rainDelayActive = state.rainDelayUntil !== null && new Date(state.rainDelayUntil).getTime() > Date.now()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Zones running" value={`${running} / ${state.zones.length}`} />
        <Stat label="Water today" value={`${state.waterUsedTodayLiters} L`} />
        <Stat label="Rain delay" value={rainDelayActive ? 'Active' : 'Off'} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CloudRain className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Rain delay</span>
          <Select
            value={rainDelayActive ? 'active' : 'none'}
            disabled={disabled}
            onValueChange={(v) => onCommand({ type: 'Irrigation', action: 'setRainDelay', hours: v === 'none' ? null : Number(v) })}
          >
            <SelectTrigger className="w-36" aria-label="Rain delay">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rainDelayActive ? <SelectItem value="active">Active</SelectItem> : null}
              {RAIN_DELAY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" disabled={disabled || running === 0} onClick={() => onCommand({ type: 'Irrigation', action: 'stopAll' })}>
          <Square /> Stop all zones
        </Button>
      </div>

      <ul className="divide-y rounded-lg border">
        {state.zones.map((zone) => (
          <li key={zone.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{zone.name}</p>
                {zone.isRunning ? <Badge variant="success">Running</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {zone.schedule.days.join(', ')} at {zone.schedule.startTime} for {zone.schedule.durationMinutes} min
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Soil</span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className={cn('h-full rounded-full', zone.soilMoisture < 30 ? 'bg-warning' : 'bg-primary')} style={{ width: `${zone.soilMoisture}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{zone.soilMoisture}%</span>
              </div>
            </div>
            {zone.isRunning ? (
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => onCommand({ type: 'Irrigation', action: 'stopZone', zoneId: zone.id })}>
                <Square /> Stop
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={disabled}
                onClick={() => onCommand({ type: 'Irrigation', action: 'startZone', zoneId: zone.id, durationMinutes: zone.schedule.durationMinutes })}
              >
                <Play /> Run {zone.schedule.durationMinutes} min
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
