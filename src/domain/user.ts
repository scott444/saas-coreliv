export type Role = 'Owner' | 'Admin' | 'Member'

export const ROLES: readonly Role[] = ['Owner', 'Admin', 'Member'] as const

/**
 * A role is held *in an organization*, not globally - the same person can own
 * their own household and be a member of a relative's. It therefore lives on
 * Organization and Member, not here.
 */
export interface User {
  id: string
  name: string
  email: string
}

export interface AuthSession {
  user: User
  accessToken: string
  expiresAt: string
}
