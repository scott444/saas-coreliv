import type {
  AuthSession,
  Home,
  HomeInput,
  HomeSystem,
  HistoryRange,
  Member,
  Organization,
  Plan,
  Reading,
  RedirectTarget,
  Role,
  Subscription,
  SystemCommand,
  SystemEvent,
  SystemState,
  User,
} from '@/domain'

export interface AuthService {
  login(email: string, password: string): Promise<AuthSession>
  register(name: string, email: string, password: string): Promise<AuthSession>
  logout(): Promise<void>
  getCurrentUser(): Promise<User | null>
  refresh(): Promise<AuthSession>
}

export interface OrganizationService {
  list(): Promise<Organization[]>
  get(orgId: string): Promise<Organization>
  members(orgId: string): Promise<Member[]>
  invite(orgId: string, email: string, role: Role): Promise<Member>
  changeRole(orgId: string, userId: string, role: Role): Promise<Member>
  removeMember(orgId: string, userId: string): Promise<void>
}

export interface BillingService {
  getSubscription(orgId: string): Promise<Subscription>
  getPlans(): Promise<Plan[]>
  startCheckout(orgId: string, planId: string): Promise<RedirectTarget>
  openPortal(orgId: string): Promise<RedirectTarget>
  cancel(orgId: string): Promise<Subscription>
}

export interface HomeSystemsService {
  listHomes(orgId: string): Promise<Home[]>
  createHome(orgId: string, input: HomeInput): Promise<Home>
  updateHome(homeId: string, input: HomeInput): Promise<Home>
  deleteHome(homeId: string): Promise<void>
  listSystems(homeId: string): Promise<HomeSystem[]>
  getSystem(systemId: string): Promise<HomeSystem>
  getSystemState(systemId: string): Promise<SystemState>
  sendCommand(systemId: string, command: SystemCommand): Promise<SystemState>
  getHistory(systemId: string, range?: HistoryRange): Promise<Reading[]>
  getEvents(systemId: string): Promise<SystemEvent[]>
}

export interface Services {
  auth: AuthService
  organizations: OrganizationService
  billing: BillingService
  homeSystems: HomeSystemsService
}

export type DataMode = 'mock' | 'http'
