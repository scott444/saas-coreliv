export type SystemType = 'Heating' | 'Cooling' | 'Irrigation' | 'Appliance'
export type SystemStatus = 'Online' | 'Offline' | 'Error'

export const SYSTEM_TYPES: readonly SystemType[] = ['Heating', 'Cooling', 'Irrigation', 'Appliance'] as const

export interface HomeSystem {
  id: string
  homeId: string
  type: SystemType
  name: string
  status: SystemStatus
}

// ---------- State (discriminated by `type`) ----------

export type HeatingMode = 'Heat' | 'Auto' | 'Off'
export type CoolingMode = 'Cool' | 'Auto' | 'Off'
export type FanSpeed = 'Low' | 'Medium' | 'High' | 'Auto'
export type PowerState = 'On' | 'Off' | 'Standby'

export interface HeatingState {
  type: 'Heating'
  currentTemp: number
  targetTemp: number
  mode: HeatingMode
  isHeating: boolean
  humidity: number
}

export interface CoolingState {
  type: 'Cooling'
  currentTemp: number
  targetTemp: number
  mode: CoolingMode
  fanSpeed: FanSpeed
  isCooling: boolean
}

export interface IrrigationZone {
  id: string
  name: string
  isRunning: boolean
  schedule: {
    days: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>
    startTime: string // "HH:MM"
    durationMinutes: number
  }
  soilMoisture: number // 0-100
}

export interface IrrigationState {
  type: 'Irrigation'
  zones: IrrigationZone[]
  rainDelayUntil: string | null
  waterUsedTodayLiters: number
}

export interface ApplianceState {
  type: 'Appliance'
  powerState: PowerState
  /** Cycles the appliance reports it can run. */
  availableCycles: string[]
  cycle: string | null
  cycleProgress: number // 0-100
  remainingMinutes: number | null
  powerDrawWatts: number
}

export type SystemState = HeatingState | CoolingState | IrrigationState | ApplianceState

export type StateOf<T extends SystemType> = Extract<SystemState, { type: T }>

// ---------- Commands (discriminated by `type`, then `action`) ----------

export type HeatingCommand =
  | { type: 'Heating'; action: 'setTargetTemp'; targetTemp: number }
  | { type: 'Heating'; action: 'setMode'; mode: HeatingMode }

export type CoolingCommand =
  | { type: 'Cooling'; action: 'setTargetTemp'; targetTemp: number }
  | { type: 'Cooling'; action: 'setMode'; mode: CoolingMode }
  | { type: 'Cooling'; action: 'setFanSpeed'; fanSpeed: FanSpeed }

export type IrrigationCommand =
  | { type: 'Irrigation'; action: 'startZone'; zoneId: string; durationMinutes: number }
  | { type: 'Irrigation'; action: 'stopZone'; zoneId: string }
  | { type: 'Irrigation'; action: 'stopAll' }
  | { type: 'Irrigation'; action: 'setRainDelay'; hours: number | null }

export type ApplianceCommand =
  | { type: 'Appliance'; action: 'setPower'; powerState: PowerState }
  | { type: 'Appliance'; action: 'startCycle'; cycle: string }
  | { type: 'Appliance'; action: 'cancelCycle' }

export type SystemCommand = HeatingCommand | CoolingCommand | IrrigationCommand | ApplianceCommand

export type CommandOf<T extends SystemType> = Extract<SystemCommand, { type: T }>

// ---------- Events ----------

export type EventSeverity = 'info' | 'warning' | 'error'

export interface SystemEvent {
  id: string
  systemId: string
  timestamp: string
  severity: EventSeverity
  message: string
}
