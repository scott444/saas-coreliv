import type {
  AuthSession,
  Home,
  HomeSystem,
  Member,
  Organization,
  Plan,
  Reading,
  Subscription,
  SystemCommand,
  SystemEvent,
  SystemState,
  User,
} from '@/domain'
import { reduceCommand } from '@/domain/reduceCommand'
import type { AuthService, BillingService, HomeSystemsService, OrganizationService, Services } from '@/services'
import { ServiceError } from '@/services'

/**
 * A second, completely independent implementation of the service interfaces.
 * No fetch, no MSW, no shared seed data. Used to prove components only depend on
 * the interfaces in src/services/types.ts.
 */
export interface FakeWorld {
  user: User
  org: Organization
  plans: Plan[]
  subscription: Subscription
  homes: Home[]
  systems: HomeSystem[]
  states: Record<string, SystemState>
  /** Return an error to make sendCommand reject for a given command. */
  rejectCommand?: (systemId: string, command: SystemCommand) => ServiceError | null
}

export function createFakeWorld(overrides: Partial<FakeWorld> = {}): FakeWorld {
  const user: User = { id: 'u1', name: 'Test Person', email: 'test@example.com', role: 'Owner' }
  const member: Member = { ...user, joinedAt: '2026-01-01T00:00:00Z', status: 'Active' }
  return {
    user,
    org: { id: 'org-fake', name: 'Fake Org', members: [member] },
    plans: [{ id: 'p1', name: 'Only Plan', priceMonthly: 5, features: ['Everything'] }],
    subscription: { planId: 'p1', status: 'Active', currentPeriodEnd: '2027-01-01T00:00:00Z' },
    homes: [{ id: 'h1', name: 'Test Cabin', address: '1 Fake Street' }],
    systems: [{ id: 's1', homeId: 'h1', type: 'Heating', name: 'Fake Boiler', status: 'Online' }],
    states: {
      s1: { type: 'Heating', currentTemp: 18, targetTemp: 21, mode: 'Heat', isHeating: true, humidity: 40 },
    },
    ...overrides,
  }
}

export function createFakeServices(world: FakeWorld = createFakeWorld()): Services {
  const session = (): AuthSession => ({ user: world.user, accessToken: 'fake', expiresAt: '2099-01-01T00:00:00Z' })

  const auth: AuthService = {
    login: async () => session(),
    register: async () => session(),
    logout: async () => {},
    getCurrentUser: async () => world.user,
    refresh: async () => session(),
  }

  const organizations: OrganizationService = {
    list: async () => [world.org],
    get: async () => world.org,
    members: async () => world.org.members,
    invite: async (_orgId, email, role) => {
      const m: Member = { id: `u${world.org.members.length + 1}`, name: email, email, role, joinedAt: new Date().toISOString(), status: 'Invited' }
      world.org.members.push(m)
      return m
    },
    changeRole: async (_orgId, userId, role) => {
      const m = world.org.members.find((x) => x.id === userId)
      if (!m) throw new ServiceError('not_found', 'no member', 404)
      m.role = role
      return m
    },
    removeMember: async (_orgId, userId) => {
      world.org.members = world.org.members.filter((m) => m.id !== userId)
    },
  }

  const billing: BillingService = {
    getSubscription: async () => world.subscription,
    getPlans: async () => world.plans,
    startCheckout: async () => ({ url: '/billing/return?checkout=p1' }),
    openPortal: async () => ({ url: '/billing/return?portal=1' }),
    cancel: async () => (world.subscription = { ...world.subscription, status: 'Canceled' }),
  }

  const homeSystems: HomeSystemsService = {
    listHomes: async () => world.homes,
    createHome: async (_orgId, input) => {
      const home = { id: `h${world.homes.length + 1}`, ...input }
      world.homes.push(home)
      return home
    },
    updateHome: async (homeId, input) => {
      const home = world.homes.find((h) => h.id === homeId)
      if (!home) throw new ServiceError('not_found', 'no home', 404)
      Object.assign(home, input)
      return home
    },
    deleteHome: async (homeId) => {
      world.homes = world.homes.filter((h) => h.id !== homeId)
    },
    listSystems: async (homeId) => world.systems.filter((s) => s.homeId === homeId),
    getSystem: async (systemId) => {
      const s = world.systems.find((x) => x.id === systemId)
      if (!s) throw new ServiceError('not_found', 'no system', 404)
      return s
    },
    getSystemState: async (systemId) => {
      const s = world.states[systemId]
      if (!s) throw new ServiceError('not_found', 'no state', 404)
      return s
    },
    sendCommand: async (systemId, command) => {
      const rejection = world.rejectCommand?.(systemId, command)
      if (rejection) throw rejection
      const prev = world.states[systemId]
      if (!prev) throw new ServiceError('not_found', 'no state', 404)
      const next = reduceCommand(prev, command)
      world.states[systemId] = next
      return next
    },
    getHistory: async (): Promise<Reading[]> => [],
    getEvents: async (): Promise<SystemEvent[]> => [],
  }

  return { auth, organizations, billing, homeSystems }
}
