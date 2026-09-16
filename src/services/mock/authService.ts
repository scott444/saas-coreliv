import type { AuthSession, User } from '@/domain'
import type { AuthService } from '../types'
import type { ApiClient } from '../apiClient'
import { tokenStore } from '../tokenStore'
import { ServiceError } from '../errors'

export function createMockAuthService(client: ApiClient): AuthService {
  return {
    async login(email, password) {
      const session = await client.post<AuthSession>('/auth/login', { email, password })
      tokenStore.set(session.accessToken)
      return session
    },
    async register(name, email, password) {
      const session = await client.post<AuthSession>('/auth/register', { name, email, password })
      tokenStore.set(session.accessToken)
      return session
    },
    async logout() {
      await client.post<void>('/auth/logout')
      tokenStore.set(null)
    },
    async getCurrentUser() {
      if (!tokenStore.get()) return null
      try {
        return await client.get<User>('/auth/me')
      } catch (error) {
        if (ServiceError.is(error) && error.code === 'unauthorized') {
          tokenStore.set(null)
          return null
        }
        throw error
      }
    },
    async refresh() {
      const session = await client.post<AuthSession>('/auth/refresh')
      tokenStore.set(session.accessToken)
      return session
    },
  }
}
