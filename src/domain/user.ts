export type Role = 'Owner' | 'Admin' | 'Member'

export const ROLES: readonly Role[] = ['Owner', 'Admin', 'Member'] as const

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface AuthSession {
  user: User
  accessToken: string
  expiresAt: string
}
