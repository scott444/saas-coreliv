import { describe } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { query } from '../db/pool.js'
import { seed } from '../db/seed.js'
import { canReachDatabase } from './database.js'

/**
 * `describe` when Postgres is reachable, `describe.skip` when it is not.
 *
 * Resolved at module load so the decision is made before any hook runs -
 * a beforeAll cannot retroactively skip a suite, it can only fail it.
 */
export const describeApi = (await canReachDatabase()) ? describe : describe.skip

/**
 * Everything hangs off users and organizations, so truncating those two
 * cascades to every row the tests create. `categories` and `plans` are
 * reference data owned by the migrations and deliberately survive.
 */
export async function resetData(): Promise<void> {
  await query('TRUNCATE users, organizations RESTART IDENTITY CASCADE')
}

export interface Result {
  status: number
  /** Parsed JSON, or the raw text when the body was not JSON. */
  body: any
}

export interface Requester {
  get(url: string): Promise<Result>
  post(url: string, body?: unknown): Promise<Result>
  put(url: string, body?: unknown): Promise<Result>
  patch(url: string, body?: unknown): Promise<Result>
  del(url: string): Promise<Result>
}

export interface TestApi {
  app: FastifyInstance
  /** Requests carrying a bearer token. */
  as(token: string): Requester
  /** Requests with no Authorization header. */
  anon: Requester
}

function requester(app: FastifyInstance, token: string | null): Requester {
  const headers = token ? { authorization: `Bearer ${token}` } : {}

  async function send(method: string, url: string, payload?: unknown): Promise<Result> {
    const response = await app.inject({
      method: method as 'GET',
      url,
      headers,
      ...(payload === undefined ? {} : { payload: payload as object }),
    })
    // inject() rather than a real socket: no port to allocate, no teardown
    // race, and the whole Fastify stack - hooks, error handler, serializer -
    // still runs exactly as it does in production.
    const text = response.body
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }
    return { status: response.statusCode, body }
  }

  return {
    get: (url: string) => send('GET', url),
    post: (url: string, body?: unknown) => send('POST', url, body ?? {}),
    put: (url: string, body?: unknown) => send('PUT', url, body ?? {}),
    patch: (url: string, body?: unknown) => send('PATCH', url, body ?? {}),
    del: (url: string) => send('DELETE', url),
  }
}

export async function createTestApi(): Promise<TestApi> {
  const app = await buildApp()
  await app.ready()
  return {
    app,
    as: (token: string) => requester(app, token),
    anon: requester(app, null),
  }
}

export async function closeTestApi(api: TestApi): Promise<void> {
  await api.app.close()
}

export const DEMO_PASSWORD = 'coreliv-demo'

export interface DemoWorld {
  token: string
  orgId: string
  userId: string
  propertyIds: string[]
}

/**
 * Truncates, re-seeds the demo household, and signs in as its owner.
 *
 * The real seed rather than a hand-built fixture: it is the only data set
 * that exercises every table and every state the UI branches on - lifetime
 * cover, lapsed cover, a task never done, an asset with no warranty at all.
 */
export async function seedDemoWorld(api: TestApi): Promise<DemoWorld> {
  await resetData()
  await seed({ quiet: true })

  const login = await api.anon.post('/api/auth/login', {
    email: 'dana@coreliv.app',
    password: DEMO_PASSWORD,
  })
  if (login.status !== 200) {
    throw new Error(`Seed login failed: ${login.status} ${JSON.stringify(login.body)}`)
  }

  const token = login.body.accessToken as string
  const orgs = await api.as(token).get('/api/orgs')
  const orgId = orgs.body[0].id as string
  const properties = await api.as(token).get(`/api/orgs/${orgId}/properties`)

  return {
    token,
    orgId,
    userId: login.body.user.id as string,
    propertyIds: (properties.body as Array<{ id: string }>).map((p) => p.id),
  }
}

/** Registers a fresh account, which gets its own organization on a free plan. */
export async function registerFreshUser(
  api: TestApi,
  email: string,
): Promise<{ token: string; orgId: string }> {
  const registered = await api.anon.post('/api/auth/register', {
    name: 'Test Person',
    email,
    password: 'a-good-password',
  })
  if (registered.status !== 200) {
    throw new Error(`Register failed: ${registered.status} ${JSON.stringify(registered.body)}`)
  }
  const token = registered.body.accessToken as string
  const orgs = await api.as(token).get('/api/orgs')
  return { token, orgId: orgs.body[0].id as string }
}

// ---------------------------------------------------------------------------
// Shape assertions
// ---------------------------------------------------------------------------

/** A Postgres array that reached the client unparsed: "{a,b}" instead of ["a","b"]. */
const UNPARSED_ARRAY = /^\{.*\}$/

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Walks a response and collects anything that did not survive the driver.
 *
 * This is the guard for the bug class that shipped: `vendor_role[]` is an
 * array of a user-defined enum, node-postgres has no parser for that OID, and
 * the raw literal `'{installer,service}'` reached the browser where the UI
 * called .map on it. Asserting per-field would only ever cover the fields
 * someone remembered; this walks whatever the endpoint actually returned.
 */
export function findRawDatabaseValues(value: unknown, path = '$'): string[] {
  const problems: string[] = []

  if (typeof value === 'string') {
    if (UNPARSED_ARRAY.test(value)) {
      problems.push(`${path} is an unparsed Postgres array: ${value}`)
    }
    return problems
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => problems.push(...findRawDatabaseValues(item, `${path}[${index}]`)))
    return problems
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      problems.push(...findRawDatabaseValues(child, `${path}.${key}`))
    }
  }

  return problems
}

/** Calendar dates must stay "YYYY-MM-DD", never become a timestamp. */
export function assertDateOnly(value: unknown, label: string): void {
  if (value === null || value === undefined) return
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) {
    throw new Error(`${label} should be a YYYY-MM-DD calendar date, got ${JSON.stringify(value)}`)
  }
}
