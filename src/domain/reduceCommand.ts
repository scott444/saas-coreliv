import type { SystemCommand, SystemState } from './system'

/**
 * Pure, client-side prediction of how a command changes state.
 * Used for optimistic updates; the server response always wins afterwards.
 */
export function reduceCommand(state: SystemState, command: SystemCommand): SystemState {
  if (state.type !== command.type) return state

  switch (command.type) {
    case 'Heating': {
      if (state.type !== 'Heating') return state
      if (command.action === 'setTargetTemp') return { ...state, targetTemp: command.targetTemp }
      return { ...state, mode: command.mode, isHeating: command.mode !== 'Off' && state.isHeating }
    }
    case 'Cooling': {
      if (state.type !== 'Cooling') return state
      if (command.action === 'setTargetTemp') return { ...state, targetTemp: command.targetTemp }
      if (command.action === 'setMode') return { ...state, mode: command.mode, isCooling: command.mode !== 'Off' && state.isCooling }
      return { ...state, fanSpeed: command.fanSpeed }
    }
    case 'Irrigation': {
      if (state.type !== 'Irrigation') return state
      switch (command.action) {
        case 'startZone':
          return { ...state, zones: state.zones.map((z) => (z.id === command.zoneId ? { ...z, isRunning: true } : z)) }
        case 'stopZone':
          return { ...state, zones: state.zones.map((z) => (z.id === command.zoneId ? { ...z, isRunning: false } : z)) }
        case 'stopAll':
          return { ...state, zones: state.zones.map((z) => ({ ...z, isRunning: false })) }
        case 'setRainDelay':
          return {
            ...state,
            rainDelayUntil: command.hours === null ? null : new Date(Date.now() + command.hours * 3_600_000).toISOString(),
          }
      }
      break
    }
    case 'Appliance': {
      if (state.type !== 'Appliance') return state
      switch (command.action) {
        case 'setPower':
          return command.powerState === 'Off'
            ? { ...state, powerState: 'Off', cycle: null, cycleProgress: 0, remainingMinutes: null, powerDrawWatts: 0 }
            : { ...state, powerState: command.powerState }
        case 'startCycle':
          return { ...state, powerState: 'On', cycle: command.cycle, cycleProgress: 0, remainingMinutes: null }
        case 'cancelCycle':
          return { ...state, cycle: null, cycleProgress: 0, remainingMinutes: null, powerDrawWatts: 0, powerState: 'Standby' }
      }
    }
  }
  return state
}
