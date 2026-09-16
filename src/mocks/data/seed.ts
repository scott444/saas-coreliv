import type {
  Home,
  HomeSystem,
  Member,
  Organization,
  Plan,
  Subscription,
  SystemEvent,
  SystemHardware,
  SystemState,
  User,
} from '@/domain'

// ---------- Users & org ----------

export const seedUsers: User[] = [
  { id: 'usr-ava', name: 'Ava Lindqvist', email: 'ava@coreliv.dev', role: 'Owner' },
  { id: 'usr-marcus', name: 'Marcus Chen', email: 'marcus@coreliv.dev', role: 'Admin' },
  { id: 'usr-priya', name: 'Priya Natarajan', email: 'priya@coreliv.dev', role: 'Member' },
]

export const seedMembers: Member[] = [
  { ...seedUsers[0]!, joinedAt: '2025-11-02T09:15:00Z', status: 'Active' },
  { ...seedUsers[1]!, joinedAt: '2026-01-14T16:40:00Z', status: 'Active' },
  { ...seedUsers[2]!, joinedAt: '2026-03-28T11:05:00Z', status: 'Active' },
]

export const seedOrganization: Organization = {
  id: 'org-lindqvist',
  name: 'Lindqvist Household',
  members: seedMembers,
}

/** The user returned for any login/register. */
export const seedCurrentUser: User = seedUsers[0]!

// ---------- Billing ----------

export const seedPlans: Plan[] = [
  {
    id: 'plan-starter',
    name: 'Starter',
    priceMonthly: 0,
    features: ['1 home', 'Up to 4 systems', 'Live state & manual control', '24h history'],
  },
  {
    id: 'plan-family',
    name: 'Family',
    priceMonthly: 12,
    features: ['Up to 3 homes', 'Unlimited systems', 'Schedules & automations', '30-day history', 'Up to 5 members'],
  },
  {
    id: 'plan-estate',
    name: 'Estate',
    priceMonthly: 39,
    features: ['Unlimited homes', 'Unlimited systems', 'Priority support', '1-year history', 'Unlimited members', 'Audit log'],
  },
]

/** Seeded as PastDue so the billing banner and payment-recovery flow are visible out of the box. */
export const seedSubscription: Subscription = {
  planId: 'plan-family',
  status: 'PastDue',
  currentPeriodEnd: '2026-09-28T00:00:00Z',
}

// ---------- Homes & systems ----------

export const seedHomes: Home[] = [
  { id: 'home-lakehouse', name: 'Lake House', address: '14 Strandvägen, Sigtuna' },
  { id: 'home-city', name: 'City Apartment', address: 'Odengatan 52, Stockholm' },
]

export const seedSystems: HomeSystem[] = [
  { id: 'sys-lake-heat', homeId: 'home-lakehouse', type: 'Heating', name: 'Ground-floor heat pump', status: 'Online' },
  { id: 'sys-lake-cool', homeId: 'home-lakehouse', type: 'Cooling', name: 'Upstairs AC', status: 'Online' },
  { id: 'sys-lake-irrig', homeId: 'home-lakehouse', type: 'Irrigation', name: 'Garden irrigation', status: 'Online' },
  { id: 'sys-lake-sauna', homeId: 'home-lakehouse', type: 'Appliance', name: 'Sauna heater', status: 'Error' },
  { id: 'sys-city-heat', homeId: 'home-city', type: 'Heating', name: 'Radiator controller', status: 'Online' },
  { id: 'sys-city-washer', homeId: 'home-city', type: 'Appliance', name: 'Washing machine', status: 'Online' },
  { id: 'sys-city-dryer', homeId: 'home-city', type: 'Appliance', name: 'Tumble dryer', status: 'Offline' },
]

export const seedStates: Record<string, SystemState> = {
  'sys-lake-heat': {
    type: 'Heating',
    currentTemp: 20.4,
    targetTemp: 21,
    mode: 'Auto',
    isHeating: true,
    humidity: 43,
  },
  'sys-lake-cool': {
    type: 'Cooling',
    currentTemp: 24.1,
    targetTemp: 23,
    mode: 'Cool',
    fanSpeed: 'Auto',
    isCooling: true,
  },
  'sys-lake-irrig': {
    type: 'Irrigation',
    zones: [
      {
        id: 'zone-front-lawn',
        name: 'Front lawn',
        isRunning: false,
        schedule: { days: ['Mon', 'Wed', 'Fri'], startTime: '06:00', durationMinutes: 20 },
        soilMoisture: 38,
      },
      {
        id: 'zone-vegetables',
        name: 'Vegetable beds',
        isRunning: true,
        schedule: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], startTime: '05:30', durationMinutes: 12 },
        soilMoisture: 61,
      },
      {
        id: 'zone-orchard',
        name: 'Orchard drip line',
        isRunning: false,
        schedule: { days: ['Tue', 'Sat'], startTime: '21:00', durationMinutes: 45 },
        soilMoisture: 29,
      },
    ],
    rainDelayUntil: null,
    waterUsedTodayLiters: 184,
  },
  'sys-lake-sauna': {
    type: 'Appliance',
    powerState: 'Off',
    availableCycles: ['Warm-up 70°', 'Sauna 85°', 'Dry-out'],
    cycle: null,
    cycleProgress: 0,
    remainingMinutes: null,
    powerDrawWatts: 0,
  },
  'sys-city-heat': {
    type: 'Heating',
    currentTemp: 19.2,
    targetTemp: 19,
    mode: 'Heat',
    isHeating: false,
    humidity: 51,
  },
  'sys-city-washer': {
    type: 'Appliance',
    powerState: 'On',
    availableCycles: ['Quick 30°', 'Eco 40°', 'Cotton 60°', 'Delicates'],
    cycle: 'Eco 40°',
    cycleProgress: 62,
    remainingMinutes: 34,
    powerDrawWatts: 1850,
  },
  'sys-city-dryer': {
    type: 'Appliance',
    powerState: 'Off',
    availableCycles: ['Cupboard dry', 'Iron dry', 'Air fluff'],
    cycle: null,
    cycleProgress: 0,
    remainingMinutes: null,
    powerDrawWatts: 0,
  },
}

// ---------- Hardware ----------

/** Calendar date `offsetDays` from today, as "YYYY-MM-DD" in local time. */
function dateOffset(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

/**
 * Keyed by system id. `sys-city-dryer` is deliberately absent so the
 * "not recorded yet" state is visible without editing anything, and the
 * warranty dates are relative to today so every badge state stays reachable:
 * lake-heat active, lake-cool expiring, lake-sauna expired.
 */
export const seedHardware: Record<string, SystemHardware> = {
  'sys-lake-heat': {
    systemId: 'sys-lake-heat',
    manufacturer: 'Nibe',
    model: 'F1255-12 R',
    serialNumber: 'NB-06621-448713',
    installedAt: '2021-09-14',
    warrantyExpiresAt: dateOffset(430),
    firmwareVersion: '9412R6',
    installer: 'Sigtuna VVS & Värme AB',
    notes: 'Brine circuit topped up at the 2025 service. Filter housing is behind the stair panel.',
  },
  'sys-lake-cool': {
    systemId: 'sys-lake-cool',
    manufacturer: 'Mitsubishi Electric',
    model: 'MSZ-LN35VG2V',
    serialNumber: 'ME-7714-220913',
    installedAt: '2022-06-02',
    warrantyExpiresAt: dateOffset(38),
    firmwareVersion: '2.4.1',
    installer: 'Kyla Nord AB',
    notes: null,
  },
  'sys-lake-irrig': {
    systemId: 'sys-lake-irrig',
    manufacturer: 'Hunter Industries',
    model: 'Pro-HC 601i-E',
    serialNumber: 'HU-PHC-0099421',
    installedAt: '2023-04-19',
    warrantyExpiresAt: null,
    firmwareVersion: '4.08',
    installer: null,
    notes: 'Orchard drip line valve has been intermittent since spring 2026 - replacement quoted.',
  },
  'sys-lake-sauna': {
    systemId: 'sys-lake-sauna',
    manufacturer: 'Harvia',
    model: 'Cilindro PC90E',
    serialNumber: 'HV-90E-118204',
    installedAt: '2018-11-30',
    warrantyExpiresAt: dateOffset(-215),
    firmwareVersion: null,
    installer: 'Bastuteknik i Uppland',
    notes: 'Out of warranty. Over-temperature cutoff has tripped twice; element set is original.',
  },
  'sys-city-heat': {
    systemId: 'sys-city-heat',
    manufacturer: 'Danfoss',
    model: 'Ally Gateway + Ally Radiator',
    serialNumber: 'DF-ALLY-553102',
    installedAt: '2024-02-08',
    warrantyExpiresAt: dateOffset(146),
    firmwareVersion: '1.16',
    installer: null,
    notes: null,
  },
  'sys-city-washer': {
    systemId: 'sys-city-washer',
    manufacturer: 'Miele',
    model: 'WWD 660 WCS',
    // Some devices genuinely have no serial the owner can reach.
    serialNumber: '',
    installedAt: '2025-05-21',
    warrantyExpiresAt: dateOffset(612),
    firmwareVersion: null,
    installer: null,
    notes: null,
  },
}

// ---------- Events ----------

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export const seedEvents: SystemEvent[] = [
  { id: 'evt-1', systemId: 'sys-lake-heat', timestamp: minutesAgo(12), severity: 'info', message: 'Target temperature reached (21°C)' },
  { id: 'evt-2', systemId: 'sys-lake-heat', timestamp: minutesAgo(95), severity: 'info', message: 'Schedule "Morning warm-up" started' },
  { id: 'evt-3', systemId: 'sys-lake-heat', timestamp: minutesAgo(410), severity: 'warning', message: 'Outdoor sensor reading delayed by 4 min' },
  { id: 'evt-4', systemId: 'sys-lake-cool', timestamp: minutesAgo(30), severity: 'info', message: 'Fan speed changed to Auto' },
  { id: 'evt-5', systemId: 'sys-lake-cool', timestamp: minutesAgo(220), severity: 'info', message: 'Cooling started (24.8°C to 23°C)' },
  { id: 'evt-6', systemId: 'sys-lake-irrig', timestamp: minutesAgo(8), severity: 'info', message: 'Zone "Vegetable beds" started (12 min)' },
  { id: 'evt-7', systemId: 'sys-lake-irrig', timestamp: minutesAgo(1440), severity: 'warning', message: 'Zone "Orchard drip line" soil moisture below 30%' },
  { id: 'evt-8', systemId: 'sys-lake-sauna', timestamp: minutesAgo(52), severity: 'error', message: 'Over-temperature cutoff triggered. Manual reset required.' },
  { id: 'evt-9', systemId: 'sys-lake-sauna', timestamp: minutesAgo(58), severity: 'warning', message: 'Sensor mismatch between bench and ceiling probes' },
  { id: 'evt-10', systemId: 'sys-city-heat', timestamp: minutesAgo(70), severity: 'info', message: 'Radiators idle, room at target' },
  { id: 'evt-11', systemId: 'sys-city-washer', timestamp: minutesAgo(41), severity: 'info', message: 'Cycle "Eco 40°" started' },
  { id: 'evt-12', systemId: 'sys-city-dryer', timestamp: minutesAgo(180), severity: 'error', message: 'Device unreachable. Last seen 3 hours ago.' },
]
