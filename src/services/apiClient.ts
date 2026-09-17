import { ServiceError, isApiErrorBody, toServiceError } from './errors'

export interface ApiClientOptions {
  baseUrl: string
  getToken?: () => string | null
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Thin JSON fetch wrapper shared by the mock (MSW-backed) and http implementations.
 * Maps HTTP error bodies of the shape { code, message } onto ServiceError.
 */
export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body)
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  private async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const token = this.options.getToken?.()
    if (token) headers.Authorization = 'Bearer ' + token

    let response: Response
    try {
      response = await fetch(this.options.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw toServiceError(error)
    }

    if (response.status === 204) return undefined as T

    const text = await response.text()

    // Not every response on this path is ours. A proxy timing out, a gateway
    // error page, or an HTML shell served for a mistyped path all arrive here
    // as non-JSON, and parsing them must not escape as a raw SyntaxError -
    // the UI only knows how to react to a ServiceError.
    let json: unknown = null
    let parsed = true
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        parsed = false
      }
    }

    if (!response.ok) {
      if (isApiErrorBody(json)) throw new ServiceError(json.code, json.message, response.status)
      throw new ServiceError(
        'unknown',
        'Request failed with status ' + response.status,
        response.status,
      )
    }

    if (!parsed) {
      throw new ServiceError('unknown', 'The server sent a response this app could not read', response.status)
    }

    return json as T
  }
}
