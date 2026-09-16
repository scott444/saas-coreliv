import type { SystemState } from '@/domain'
import { formatTemp } from '@/lib/format'

/** Compact one-glance rendering of a system's live state for dashboard cards. */
export function StateSummary({ state }: { state: SystemState }) {
  switch (state.type) {
    case 'Heating':
      return (
        <Summary
          primary={formatTemp(state.currentTemp)}
          secondary={`Target ${state.targetTemp}°C · ${state.mode}`}
          hint={state.isHeating ? 'Heating' : state.mode === 'Off' ? 'Off' : 'Idle'}
        />
      )
    case 'Cooling':
      return (
        <Summary
          primary={formatTemp(state.currentTemp)}
          secondary={`Target ${state.targetTemp}°C · Fan ${state.fanSpeed}`}
          hint={state.isCooling ? 'Cooling' : state.mode === 'Off' ? 'Off' : 'Idle'}
        />
      )
    case 'Irrigation': {
      const running = state.zones.filter((z) => z.isRunning)
      return (
        <Summary
          primary={running.length > 0 ? `${running.length} of ${state.zones.length} zones running` : 'All zones idle'}
          secondary={`${state.waterUsedTodayLiters} L used today`}
          hint={state.rainDelayUntil ? 'Rain delay' : running.length > 0 ? 'Watering' : 'Scheduled'}
        />
      )
    }
    case 'Appliance':
      return (
        <Summary
          primary={state.cycle ?? (state.powerState === 'Off' ? 'Powered off' : state.powerState)}
          secondary={state.cycle ? `${state.cycleProgress}% · ${state.remainingMinutes ?? '–'} min left` : `${state.powerDrawWatts} W`}
          hint={state.powerState}
        />
      )
  }
}

function Summary({ primary, secondary, hint }: { primary: string; secondary: string; hint: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold tracking-tight">{primary}</p>
        <p className="truncate text-sm text-muted-foreground">{secondary}</p>
      </div>
      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{hint}</span>
    </div>
  )
}
