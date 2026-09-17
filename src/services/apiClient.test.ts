import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from './apiClient'
import { ServiceError } from './errors'

/**
 * The one test that cares about the wire.
 *
 * Everything above this layer is tested through the service interfaces, so
 * this is the only place that pins down how the API's `{ code, message }`
 * bodies become the ServiceError codes the UI branches on.
 */
function client(response: Response | Error) {
  const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return {
    api: new ApiClient({ baseUrl: '/api', getToken: () => 'token-123' }),
    fetchMock,
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('ApiClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the bearer token and parses the body', async () => {
    const { api, fetchMock } = client(json({ id: 'asset-1' }))

    await expect(api.get<{ id: string }>('/assets/asset-1')).resolves.toEqual({ id: 'asset-1' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/assets/asset-1')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123')
  })

  it('only sets a content type when there is a body to describe', async () => {
    const { api, fetchMock } = client(json({}))
    await api.post('/auth/logout')
    const [, init] = fetchMock.mock.calls[0]!
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  it('maps a { code, message } body onto ServiceError', async () => {
    const { api } = client(json({ code: 'limit_exceeded', message: 'Your plan covers 25 assets.' }, 402))

    await expect(api.get('/orgs/1/assets')).rejects.toMatchObject({
      code: 'limit_exceeded',
      message: 'Your plan covers 25 assets.',
      status: 402,
    })
  })

  it('falls back to `unknown` when an error body is not the agreed shape', async () => {
    const { api } = client(new Response('<html>502</html>', { status: 502 }))
    const error = await api.get('/assets').catch((e: unknown) => e)
    expect(ServiceError.is(error) && error.code).toBe('unknown')
  })

  it('reports a thrown fetch as a network error rather than an unknown one', async () => {
    const { api } = client(new TypeError('Failed to fetch'))
    await expect(api.get('/assets')).rejects.toMatchObject({ code: 'network', status: 0 })
  })

  it('returns undefined for 204, which is what every delete answers with', async () => {
    const { api } = client(new Response(null, { status: 204 }))
    await expect(api.delete('/assets/asset-1')).resolves.toBeUndefined()
  })
})
