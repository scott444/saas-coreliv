import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  closeTestApi,
  createTestApi,
  describeApi,
  seedDemoWorld,
  type DemoWorld,
  type TestApi,
} from '../test/harness.js'

describeApi('authentication', () => {
  let api: TestApi
  let world: DemoWorld

  beforeAll(async () => {
    api = await createTestApi()
    world = await seedDemoWorld(api)
  })

  afterAll(async () => {
    await closeTestApi(api)
  })

  it('signs in a seeded user and returns a session', async () => {
    const result = await api.anon.post('/api/auth/login', {
      email: 'dana@coreliv.app',
      password: 'coreliv-demo',
    })

    expect(result.status).toBe(200)
    expect(result.body.user).toMatchObject({ name: 'Dana Reyes', email: 'dana@coreliv.app' })
    expect(typeof result.body.accessToken).toBe('string')
    expect(result.body.accessToken.length).toBeGreaterThan(20)
    // The password hash must never travel.
    expect(JSON.stringify(result.body)).not.toMatch(/scrypt|password/i)
  })

  it('accepts the email case-insensitively', async () => {
    const result = await api.anon.post('/api/auth/login', {
      email: 'DANA@Coreliv.App',
      password: 'coreliv-demo',
    })
    expect(result.status).toBe(200)
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await api.anon.post('/api/auth/login', {
      email: 'dana@coreliv.app',
      password: 'not-the-password',
    })
    const unknownEmail = await api.anon.post('/api/auth/login', {
      email: 'nobody@coreliv.app',
      password: 'not-the-password',
    })

    // Distinguishing the two would confirm which addresses have accounts.
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual(unknownEmail.body)
  })

  it('answers /auth/me with null rather than 401 when signed out', async () => {
    // The app asks this on boot to decide whether to show the login page;
    // a 401 would render as an error.
    const result = await api.anon.get('/api/auth/me')
    expect(result.status).toBe(200)
    expect(result.body).toBeNull()
  })

  it('answers /auth/me with the user when signed in', async () => {
    const result = await api.as(world.token).get('/api/auth/me')
    expect(result.status).toBe(200)
    expect(result.body.email).toBe('dana@coreliv.app')
  })

  it('stops honouring a token after logout', async () => {
    const login = await api.anon.post('/api/auth/login', {
      email: 'sam@coreliv.app',
      password: 'coreliv-demo',
    })
    const token = login.body.accessToken

    expect((await api.as(token).get('/api/orgs')).status).toBe(200)

    const out = await api.as(token).post('/api/auth/logout')
    expect(out.status).toBe(204)

    // Revocation is immediate because the token is a row, not a signature.
    expect((await api.as(token).get('/api/orgs')).status).toBe(401)
  })

  it('rotates the token on refresh and drops the old one', async () => {
    const login = await api.anon.post('/api/auth/login', {
      email: 'sam@coreliv.app',
      password: 'coreliv-demo',
    })
    const original = login.body.accessToken

    const refreshed = await api.as(original).post('/api/auth/refresh')
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.accessToken).not.toBe(original)

    expect((await api.as(refreshed.body.accessToken).get('/api/orgs')).status).toBe(200)
    // A refresh that left the old token live would double the blast radius
    // of a leak rather than reduce it.
    expect((await api.as(original).get('/api/orgs')).status).toBe(401)
  })

  it('rejects a forged or truncated token', async () => {
    for (const token of ['', 'nonsense', world.token.slice(0, -4), `${world.token}xxxx`]) {
      expect((await api.as(token).get('/api/orgs')).status).toBe(401)
    }
  })

  it('gives a new account its own organization on the free plan', async () => {
    const result = await api.anon.post('/api/auth/register', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'a-good-password',
    })
    expect(result.status).toBe(200)

    const orgs = await api.as(result.body.accessToken).get('/api/orgs')
    expect(orgs.body).toHaveLength(1)
    expect(orgs.body[0]).toMatchObject({ name: "Ada's home", role: 'Owner' })

    const subscription = await api
      .as(result.body.accessToken)
      .get(`/api/orgs/${orgs.body[0].id}/subscription`)
    expect(subscription.body.planId).toBe('starter')
  })

  it('refuses a second registration for the same email', async () => {
    const again = await api.anon.post('/api/auth/register', {
      name: 'Someone Else',
      email: 'ada@example.com',
      password: 'a-good-password',
    })
    expect(again.status).toBe(422)
    expect(again.body.message).toMatch(/already exists/)
  })

  it('lets registering claim a pending invite instead of colliding with it', async () => {
    const invited = await api.as(world.token).post(`/api/orgs/${world.orgId}/members`, {
      email: 'newcomer@example.com',
      role: 'Member',
    })
    expect(invited.status).toBe(201)
    expect(invited.body.status).toBe('Invited')

    // The invite creates a password-less user row, so this has to claim it
    // rather than fail on the unique email index.
    const registered = await api.anon.post('/api/auth/register', {
      name: 'New Comer',
      email: 'newcomer@example.com',
      password: 'a-good-password',
    })
    expect(registered.status).toBe(200)

    const orgs = await api.as(registered.body.accessToken).get('/api/orgs')
    expect(orgs.body.map((o: { id: string }) => o.id)).toContain(world.orgId)

    const members = await api.as(world.token).get(`/api/orgs/${world.orgId}/members`)
    const now = members.body.find((m: { email: string }) => m.email === 'newcomer@example.com')
    expect(now.status).toBe('Active')
  })

  it('will not sign in as someone who only has a pending invite', async () => {
    // jules is seeded as invited and never registered, so has no password.
    const result = await api.anon.post('/api/auth/login', {
      email: 'jules@example.com',
      password: '',
    })
    expect(result.status).toBe(422)

    const withPassword = await api.anon.post('/api/auth/login', {
      email: 'jules@example.com',
      password: 'anything-at-all',
    })
    expect(withPassword.status).toBe(401)
  })

  it('requires a usable password and a real email on registration', async () => {
    const short = await api.anon.post('/api/auth/register', {
      name: 'Too Short',
      email: 'short@example.com',
      password: 'abc',
    })
    expect(short.status).toBe(422)
    expect(short.body.message).toMatch(/at least 8/)

    const bad = await api.anon.post('/api/auth/register', {
      name: 'Bad Email',
      email: 'not-an-email',
      password: 'a-good-password',
    })
    expect(bad.status).toBe(422)
  })
})
