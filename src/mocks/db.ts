import type {
  ApplianceState,
  Home,
  HomeSystem,
  Member,
  Organization,
  Subscription,
  SystemCommand,
  SystemEvent,
  SystemState,
  User,
} from '@/domain'
import {
  seedCurrentUser,
  seedEvents,
  seedHomes,
  seedOrganization,
  seedStates,
  seedSubscription,
  seedSystems,
} from './data/seed'

/**
 * In-memory mutable store behind the MSW handlers. Deep-cloned from seed data so
 * tests can call `resetDb()` between cases.
 */
interface MockDb {
  currentUser: User
  organizations: Organization[]
  subscription: Subscription
  homes: Home[]
  systems: HomeSystem[]
  states: Record<string, SystemState>
  events: SystemEvent[]
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function createDb(): MockDb {
  return {
    currentUser: clone(seedCurrentUser),
    organizations: [clone(seedOrganization)],
    subscription: clone(seedSubscription),
    homes: clone(seedHomes),
    systems: clone(seedSystems),
    states: clone(seedStates),
    events: clone(seedEvents),
  }
}

export let db: MockDb = createDb()

export function resetDb(): void {
  db = createDb()
}

let idCounter = 1
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}${idCounter}`
}

export function findOrg(orgId: string): Organization | undefined {
  return db.organizations.find((o) => o.id === orgId)
}

export function findMember(orgId: string, userId: string): Member | undefined {
  return findOrg(orgId)?.members.find((m) => m.id === userId)
}

export function pushEvent(systemId: string, severity: SystemEvent['severity'], message: string): void {
  db.events.unshift({ id: nextId('evt'), systemId, timestamp: new Date().toISOString(), severity, message })
}

/** Simulate a little live drift so repeated reads look alive. */
export function tickState(systemId: string): SystemState | undefined {
  const state = db.states[systemId]
  if (!state) return undefined
  switch (state.type) {
    case 'Heating': {
      const delta = state.targetTemp - state.currentTemp
      if (state.mode !== 'Off' && Math.abs(delta) > 0.05) {
        state.currentTemp = Number((state.currentTemp + Math.sign(delta) * 0.1).toFixed(1))
      }
      state.isHeating = state.mode !== 'Off' && state.currentTemp < state.targetTemp - 0.2
      break
    }
    case 'Cooling': {
      const delta = state.targetTemp - state.currentTemp
      if (state.mode !== 'Off' && Math.abs(delta) > 0.05) {
        state.currentTemp = Number((state.currentTemp + Math.sign(delta) * 0.1).toFixed(1))
      }
      state.isCooling = state.mode !== 'Off' && state.currentTemp > state.targetTemp + 0.2
      break
    }
    case 'Appliance': {
      if (state.powerState === 'On' && state.cycle && state.remainingMinutes !== null) {
        state.cycleProgress = Math.min(100, state.cycleProgress + 1)
        state.remainingMinutes = Math.max(0, state.remainingMinutes - 1)
        if (state.cycleProgress >= 100) finishCycle(state)
      }
      break
    }
    case 'Irrigation':
      break
  }
  return state
}

function finishCycle(state: ApplianceState): void {
  state.cycle = null
  state.cycleProgress = 0
  state.remainingMinutes = null
  state.powerDrawWatts = 0
  state.powerState = 'Standby'
}

export type CommandOutcome = { ok: true; state: SystemState } | { ok: false; code: 'command_failed' | 'validation'; message: string }

/** Applies a command to a state. Mismatched type/command pairs are treated as validation errors. */
export function applyCommand(systemId: string, command: SystemCommand): CommandOutcome {
  const state = db.states[systemId]
  if (!state) return { ok: false, code: 'validation', message: 'No state for system' }
  if (state.type !== command.type) {
    return { ok: false, code: 'validation', message: `Command type ${command.type} does not match system type ${state.type}` }
  }

  switch (command.type) {
    case 'Heating': {
      const s = state as Extract<SystemState, { type: 'Heating' }>
      if (command.action === 'setTargetTemp') {
        if (command.targetTemp < 5 || command.targetTemp > 30) {
          return { ok: false, code: 'validation', message: 'Target must be between 5°C and 30°C' }
        }
        s.targetTemp = command.targetTemp
        pushEvent(systemId, 'info', `Target set to ${command.targetTemp}°C`)
      } else {
        s.mode = command.mode
        pushEvent(systemId, 'info', `Mode changed to ${command.mode}`)
      }
      s.isHeating = s.mode !== 'Off' && s.currentTemp < s.targetTemp - 0.2
      return { ok: true, state: s }
    }
    case 'Cooling': {
      const s = state as Extract<SystemState, { type: 'Cooling' }>
      if (command.action === 'setTargetTemp') {
        if (command.targetTemp < 16 || command.targetTemp > 30) {
          return { ok: false, code: 'validation', message: 'Target must be between 16°C and 30°C' }
        }
        s.targetTemp = command.targetTemp
        pushEvent(systemId, 'info', `Target set to ${command.targetTemp}°C`)
      } else if (command.action === 'setMode') {
        s.mode = command.mode
        pushEvent(systemId, 'info', `Mode changed to ${command.mode}`)
      } else {
        s.fanSpeed = command.fanSpeed
        pushEvent(systemId, 'info', `Fan speed changed to ${command.fanSpeed}`)
      }
      s.isCooling = s.mode !== 'Off' && s.currentTemp > s.targetTemp + 0.2
      return { ok: true, state: s }
    }
    case 'Irrigation': {
      const s = state as Extract<SystemState, { type: 'Irrigation' }>
      if (command.action === 'stopAll') {
        s.zones.forEach((z) => (z.isRunning = false))
        pushEvent(systemId, 'info', 'All zones stopped')
        return { ok: true, state: s }
      }
      if (command.action === 'setRainDelay') {
        s.rainDelayUntil = command.hours === null ? null : new Date(Date.now() + command.hours * 3_600_000).toISOString()
        pushEvent(systemId, 'info', command.hours === null ? 'Rain delay cleared' : `Rain delay set for ${command.hours}h`)
        return { ok: true, state: s }
      }
      const zone = s.zones.find((z) => z.id === command.zoneId)
      if (!zone) return { ok: false, code: 'validation', message: 'Unknown zone' }
      if (command.action === 'startZone') {
        // Deterministic failure case: the orchard valve never responds.
        if (zone.id === 'zone-orchard') {
          pushEvent(systemId, 'error', `Zone "${zone.name}" valve did not respond`)
          return { ok: false, code: 'command_failed', message: `Valve for "${zone.name}" did not respond. Try again or check the controller.` }
        }
        zone.isRunning = true
        pushEvent(systemId, 'info', `Zone "${zone.name}" started (${command.durationMinutes} min)`)
      } else {
        zone.isRunning = false
        pushEvent(systemId, 'info', `Zone "${zone.name}" stopped`)
      }
      return { ok: true, state: s }
    }
    case 'Appliance': {
      const s = state as ApplianceState
      if (command.action === 'setPower') {
        if (command.powerState === 'Off') finishCycle(s)
        s.powerState = command.powerState
        pushEvent(systemId, 'info', `Power set to ${command.powerState}`)
      } else if (command.action === 'startCycle') {
        s.powerState = 'On'
        s.cycle = command.cycle
        s.cycleProgress = 0
        s.remainingMinutes = 45
        s.powerDrawWatts = 1600
        pushEvent(systemId, 'info', `Cycle "${command.cycle}" started`)
      } else {
        finishCycle(s)
        pushEvent(systemId, 'info', 'Cycle cancelled')
      }
      return { ok: true, state: s }
    }
  }
}
