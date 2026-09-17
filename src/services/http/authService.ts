import type { AuthSession, User } from '@/domain'
import type { AuthService } from '../types'
import type { ApiClient } from '../apiClient'
import { tokenStore } from '../tokenStore'
import { ServiceError } from '../errors'

/**
 * The bearer token is the one piece of state this layer owns.
 *
 * It is stored here rather than in a React context so that `ApiClient` can
 * read it synchronously on every request - including the ones fired before
 * any component has mounted.
 */
export function createHttpAuthService(client: ApiClient): AuthService {
  async function persist(session: AuthSession): Promise<AuthSession> {
    tokenStore.set(session.accessToken)
    return session
  }

  return {
    async login(email, password) {
      return persist(await client.post<AuthSession>('/auth/login', { email, password }))
    },

    async register(name, email, password) {
      return persist(await client.post<AuthSession>('/auth/register', { name, email, password }))
    },

    async logout() {
      try {
        await client.post<void>('/auth/logout')
      } finally {
        // Clear locally even if the call failed. A token the server still
        // knows about is better than a session the user cannot get out of.
        tokenStore.set(null)
      }
    },

    async getCurrentUser() {
      if (!tokenStore.get()) return null
      try {
        return await client.get<User | null>('/auth/me')
      } catch (error) {
        // A stale token should read as "signed out", not as an error page.
        if (ServiceError.is(error) && error.code === 'unauthorized') {
          tokenStore.set(null)
          return null
        }
        throw error
      }
    },

    async refresh() {
      return persist(await client.post<AuthSession>('/auth/refresh'))
    },
  }
}
