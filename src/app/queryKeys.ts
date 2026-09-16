import type { HistoryRange } from '@/domain'

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  orgs: {
    all: ['orgs'] as const,
    detail: (orgId: string) => ['orgs', orgId] as const,
    members: (orgId: string) => ['orgs', orgId, 'members'] as const,
  },
  billing: {
    plans: ['billing', 'plans'] as const,
    subscription: (orgId: string) => ['orgs', orgId, 'subscription'] as const,
  },
  homes: {
    list: (orgId: string) => ['orgs', orgId, 'homes'] as const,
  },
  systems: {
    list: (homeId: string) => ['homes', homeId, 'systems'] as const,
    detail: (systemId: string) => ['systems', systemId] as const,
    state: (systemId: string) => ['systems', systemId, 'state'] as const,
    history: (systemId: string, range: HistoryRange) => ['systems', systemId, 'history', range] as const,
    events: (systemId: string) => ['systems', systemId, 'events'] as const,
  },
}
