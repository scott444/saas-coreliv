import { HttpResponse, delay, http } from 'msw'
import type {
  AuthSession,
  HardwareRegisterEntry,
  HistoryRange,
  HomeInput,
  Member,
  Role,
  SystemCommand,
  SystemHardware,
  SystemHardwareInput,
} from '@/domain'
import type { ApiErrorBody, ServiceErrorCode } from '@/services/errors'
import { seedPlans } from './data/seed'
import { generateHistory } from './data/history'
import { applyCommand, db, findMember, findOrg, nextId, pushEvent, tickState } from './db'

// ---------- helpers ----------

/** Realistic network latency in dev; zero in tests so suites stay fast. */
export const mockConfig = {
  latency: import.meta.env.MODE === 'test' ? ([0, 0] as const) : ([180, 650] as const),
}

async function latency(): Promise<void> {
  const [min, max] = mockConfig.latency
  if (max === 0) return
  await delay(min + Math.random() * (max - min))
}

function error(code: ServiceErrorCode, message: string, status: number) {
  const body: ApiErrorBody = { code, message }
  return HttpResponse.json(body, { status })
}

/** Match any origin so the same handlers serve the browser (relative /api) and node tests (absolute URL). */
const api = (path: string) => `*/api${path}`

function requireAuth(request: Request) {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return error('unauthorized', 'Sign in to continue', 401)
  return null
}

function makeSession(): AuthSession {
  return {
    user: db.currentUser,
    accessToken: `mock-token-${Date.now().toString(36)}`,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Trim to a string, or null for blank/absent - hardware fields are all optional text. */
function optionalText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text === '' ? null : text
}

function optionalDate(value: unknown): string | null | 'invalid' {
  const text = optionalText(value)
  if (text === null) return null
  if (!DATE_ONLY.test(text) || Number.isNaN(Date.parse(text))) return 'invalid'
  return text
}

// ---------- handlers ----------

export const handlers = [
  // Auth: any credentials succeed.
  http.post(api('/auth/login'), async ({ request }) => {
    await latency()
    const body = (await request.json()) as { email?: string }
    if (!body.email) return error('validation', 'Email is required', 400)
    return HttpResponse.json(makeSession())
  }),

  http.post(api('/auth/register'), async ({ request }) => {
    await latency()
    const body = (await request.json()) as { name?: string; email?: string }
    if (!body.name || !body.email) return error('validation', 'Name and email are required', 400)
    db.currentUser = { ...db.currentUser, name: body.name, email: body.email }
    const org = db.organizations[0]
    const owner = org?.members.find((m) => m.id === db.currentUser.id)
    if (owner) Object.assign(owner, { name: body.name, email: body.email })
    return HttpResponse.json(makeSession())
  }),

  http.post(api('/auth/logout'), async () => {
    await latency()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/auth/me'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json(db.currentUser)
  }),

  http.post(api('/auth/refresh'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json(makeSession())
  }),

  // Organizations
  http.get(api('/orgs'), async ({ request }) => {
    await latency()
    return requireAuth(request) ?? HttpResponse.json(db.organizations)
  }),

  http.get(api('/orgs/:orgId'), async ({ params }) => {
    await latency()
    const org = findOrg(String(params.orgId))
    return org ? HttpResponse.json(org) : error('not_found', 'Organization not found', 404)
  }),

  http.get(api('/orgs/:orgId/members'), async ({ params }) => {
    await latency()
    const org = findOrg(String(params.orgId))
    return org ? HttpResponse.json(org.members) : error('not_found', 'Organization not found', 404)
  }),

  http.post(api('/orgs/:orgId/members'), async ({ params, request }) => {
    await latency()
    const org = findOrg(String(params.orgId))
    if (!org) return error('not_found', 'Organization not found', 404)
    const body = (await request.json()) as { email?: string; role?: Role }
    if (!body.email || !body.role) return error('validation', 'Email and role are required', 400)
    if (org.members.some((m) => m.email.toLowerCase() === body.email!.toLowerCase())) {
      return error('validation', `${body.email} is already a member`, 409)
    }
    const member: Member = {
      id: nextId('usr'),
      name: body.email.split('@')[0] ?? body.email,
      email: body.email,
      role: body.role,
      joinedAt: new Date().toISOString(),
      status: 'Invited',
    }
    org.members.push(member)
    return HttpResponse.json(member, { status: 201 })
  }),

  http.patch(api('/orgs/:orgId/members/:userId'), async ({ params, request }) => {
    await latency()
    const member = findMember(String(params.orgId), String(params.userId))
    if (!member) return error('not_found', 'Member not found', 404)
    const body = (await request.json()) as { role?: Role }
    if (!body.role) return error('validation', 'Role is required', 400)
    if (member.role === 'Owner' && body.role !== 'Owner') {
      return error('validation', 'Transfer ownership before changing the owner role', 403)
    }
    member.role = body.role
    return HttpResponse.json(member)
  }),

  http.delete(api('/orgs/:orgId/members/:userId'), async ({ params }) => {
    await latency()
    const org = findOrg(String(params.orgId))
    const member = org?.members.find((m) => m.id === String(params.userId))
    if (!org || !member) return error('not_found', 'Member not found', 404)
    if (member.role === 'Owner') return error('validation', 'The owner cannot be removed', 403)
    org.members = org.members.filter((m) => m.id !== member.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Billing
  http.get(api('/billing/plans'), async () => {
    await latency()
    return HttpResponse.json(seedPlans)
  }),

  http.get(api('/orgs/:orgId/billing/subscription'), async ({ params }) => {
    await latency()
    if (!findOrg(String(params.orgId))) return error('not_found', 'Organization not found', 404)
    return HttpResponse.json(db.subscription)
  }),

  // Mock checkout: applies the plan immediately and "redirects" back into the app.
  http.post(api('/orgs/:orgId/billing/checkout'), async ({ request }) => {
    await latency()
    const body = (await request.json()) as { planId?: string }
    const plan = seedPlans.find((p) => p.id === body.planId)
    if (!plan) return error('validation', 'Unknown plan', 400)
    db.subscription = {
      planId: plan.id,
      status: 'Active',
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }
    return HttpResponse.json({ url: `/billing/return?checkout=${encodeURIComponent(plan.id)}` })
  }),

  // Mock portal: visiting it "fixes" a past-due payment.
  http.post(api('/orgs/:orgId/billing/portal'), async () => {
    await latency()
    if (db.subscription.status === 'PastDue') {
      db.subscription = {
        ...db.subscription,
        status: 'Active',
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      }
    }
    return HttpResponse.json({ url: '/billing/return?portal=1' })
  }),

  http.post(api('/orgs/:orgId/billing/cancel'), async () => {
    await latency()
    if (db.subscription.status === 'Canceled') return error('validation', 'Subscription is already canceled', 409)
    db.subscription = { ...db.subscription, status: 'Canceled' }
    return HttpResponse.json(db.subscription)
  }),

  // Homes
  http.get(api('/orgs/:orgId/homes'), async ({ params }) => {
    await latency()
    if (!findOrg(String(params.orgId))) return error('not_found', 'Organization not found', 404)
    return HttpResponse.json(db.homes)
  }),

  http.post(api('/orgs/:orgId/homes'), async ({ request }) => {
    await latency()
    const body = (await request.json()) as Partial<HomeInput>
    if (!body.name?.trim()) return error('validation', 'Home name is required', 400)
    const home = { id: nextId('home'), name: body.name.trim(), address: body.address?.trim() ?? '' }
    db.homes.push(home)
    return HttpResponse.json(home, { status: 201 })
  }),

  http.put(api('/homes/:homeId'), async ({ params, request }) => {
    await latency()
    const home = db.homes.find((h) => h.id === String(params.homeId))
    if (!home) return error('not_found', 'Home not found', 404)
    const body = (await request.json()) as Partial<HomeInput>
    if (!body.name?.trim()) return error('validation', 'Home name is required', 400)
    home.name = body.name.trim()
    home.address = body.address?.trim() ?? ''
    return HttpResponse.json(home)
  }),

  http.delete(api('/homes/:homeId'), async ({ params }) => {
    await latency()
    const id = String(params.homeId)
    if (!db.homes.some((h) => h.id === id)) return error('not_found', 'Home not found', 404)
    db.homes = db.homes.filter((h) => h.id !== id)
    db.systems = db.systems.filter((s) => s.homeId !== id)
    return new HttpResponse(null, { status: 204 })
  }),

  // The cross-home register: one call instead of a query per home plus one per system.
  http.get(api('/orgs/:orgId/hardware'), async ({ params }) => {
    await latency()
    if (!findOrg(String(params.orgId))) return error('not_found', 'Organization not found', 404)
    const homesById = new Map(db.homes.map((h) => [h.id, h]))
    const entries: HardwareRegisterEntry[] = db.systems
      .filter((system) => homesById.has(system.homeId))
      .map((system) => ({
        system,
        homeId: system.homeId,
        homeName: homesById.get(system.homeId)?.name ?? '',
        hardware: db.hardware[system.id] ?? null,
      }))
    return HttpResponse.json(entries)
  }),

  // Systems
  http.get(api('/homes/:homeId/systems'), async ({ params }) => {
    await latency()
    if (!db.homes.some((h) => h.id === String(params.homeId))) return error('not_found', 'Home not found', 404)
    return HttpResponse.json(db.systems.filter((s) => s.homeId === String(params.homeId)))
  }),

  http.get(api('/systems/:systemId'), async ({ params }) => {
    await latency()
    const system = db.systems.find((s) => s.id === String(params.systemId))
    return system ? HttpResponse.json(system) : error('not_found', 'System not found', 404)
  }),

  http.get(api('/systems/:systemId/state'), async ({ params }) => {
    await latency()
    const id = String(params.systemId)
    const system = db.systems.find((s) => s.id === id)
    if (!system) return error('not_found', 'System not found', 404)
    if (system.status === 'Offline') return error('device_offline', `${system.name} is offline`, 503)
    const state = tickState(id)
    return state ? HttpResponse.json(state) : error('not_found', 'No state for system', 404)
  }),

  http.post(api('/systems/:systemId/commands'), async ({ params, request }) => {
    await latency()
    const id = String(params.systemId)
    const system = db.systems.find((s) => s.id === id)
    if (!system) return error('not_found', 'System not found', 404)
    if (db.subscription.status === 'Canceled') {
      return error('subscription_expired', 'Your subscription has ended. Reactivate to control systems.', 402)
    }
    if (system.status === 'Offline') return error('device_offline', `${system.name} is offline and cannot accept commands`, 503)
    if (system.status === 'Error') {
      pushEvent(id, 'error', 'Command rejected while device is in error state')
      return error('command_failed', `${system.name} is in an error state. Reset the device before sending commands.`, 409)
    }
    const command = (await request.json()) as SystemCommand
    const outcome = applyCommand(id, command)
    if (!outcome.ok) return error(outcome.code, outcome.message, outcome.code === 'validation' ? 400 : 409)
    return HttpResponse.json(outcome.state)
  }),

  http.get(api('/systems/:systemId/history'), async ({ params, request }) => {
    await latency()
    const system = db.systems.find((s) => s.id === String(params.systemId))
    if (!system) return error('not_found', 'System not found', 404)
    const range = (new URL(request.url).searchParams.get('range') ?? '24h') as HistoryRange
    return HttpResponse.json(generateHistory(system.id, system.type, range === '7d' ? '7d' : '24h'))
  }),

  http.get(api('/systems/:systemId/hardware'), async ({ params }) => {
    await latency()
    const id = String(params.systemId)
    if (!db.systems.some((s) => s.id === id)) return error('not_found', 'System not found', 404)
    // 200 with a null body: the system exists, its hardware just was not recorded.
    return HttpResponse.json(db.hardware[id] ?? null)
  }),

  http.put(api('/systems/:systemId/hardware'), async ({ params, request }) => {
    await latency()
    const id = String(params.systemId)
    if (!db.systems.some((s) => s.id === id)) return error('not_found', 'System not found', 404)

    const body = (await request.json()) as Partial<SystemHardwareInput>
    const manufacturer = optionalText(body.manufacturer)
    const model = optionalText(body.model)
    if (!manufacturer) return error('validation', 'Manufacturer is required', 400)
    if (!model) return error('validation', 'Model is required', 400)

    const installedAt = optionalDate(body.installedAt)
    if (installedAt === 'invalid') return error('validation', 'Install date must be a valid date', 400)
    const warrantyExpiresAt = optionalDate(body.warrantyExpiresAt)
    if (warrantyExpiresAt === 'invalid') return error('validation', 'Warranty end must be a valid date', 400)
    if (installedAt && warrantyExpiresAt && warrantyExpiresAt < installedAt) {
      return error('validation', 'Warranty cannot end before the install date', 400)
    }

    const record: SystemHardware = {
      systemId: id,
      manufacturer,
      model,
      serialNumber: optionalText(body.serialNumber) ?? '',
      installedAt,
      warrantyExpiresAt,
      firmwareVersion: optionalText(body.firmwareVersion),
      installer: optionalText(body.installer),
      notes: optionalText(body.notes),
    }
    db.hardware[id] = record
    pushEvent(id, 'info', 'Hardware details updated')
    return HttpResponse.json(record)
  }),

  http.get(api('/systems/:systemId/events'), async ({ params }) => {
    await latency()
    const id = String(params.systemId)
    if (!db.systems.some((s) => s.id === id)) return error('not_found', 'System not found', 404)
    return HttpResponse.json(db.events.filter((e) => e.systemId === id).slice(0, 20))
  }),
]
