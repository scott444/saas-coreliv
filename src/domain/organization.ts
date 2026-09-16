import type { Role, User } from './user'

export interface Member extends User {
  joinedAt: string
  status: 'Active' | 'Invited'
}

export interface Organization {
  id: string
  name: string
  members: Member[]
}

export interface InviteInput {
  email: string
  role: Role
}
