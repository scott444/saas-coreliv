import type { AuthService } from '../types'
import type { ApiClient } from '../apiClient'
import { notImplemented } from './notImplemented'

// TODO: replace with real auth provider calls. The client is available for REST-backed auth.
export function createHttpAuthService(_client: ApiClient): AuthService {
  return {
    login: () => notImplemented('AuthService', 'login'),
    register: () => notImplemented('AuthService', 'register'),
    logout: () => notImplemented('AuthService', 'logout'),
    getCurrentUser: () => notImplemented('AuthService', 'getCurrentUser'),
    refresh: () => notImplemented('AuthService', 'refresh'),
  }
}
