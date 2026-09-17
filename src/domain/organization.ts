import type { Role, User } from './user.js'

export interface Member extends User {
  role: Role
  joinedAt: string
  /** `Invited` until they accept; they hold no session until then. */
  status: 'Active' | 'Invited'
}

export interface Organization {
  id: string
  name: string
  /** The signed-in user's role in this organization. */
  role: Role
  memberCount: number
  propertyCount: number
}

export interface InviteInput {
  email: string
  role: Role
}
