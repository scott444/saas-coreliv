/**
 * Query keys are nested the way the data is owned, so invalidating an
 * organization drops everything under it in one call.
 */
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
  properties: {
    list: (orgId: string) => ['orgs', orgId, 'properties'] as const,
    locations: (propertyId: string) => ['properties', propertyId, 'locations'] as const,
    accessPoints: (propertyId: string) => ['properties', propertyId, 'access-points'] as const,
  },
  assets: {
    /** The whole register for an org, filtered client-side. */
    register: (orgId: string) => ['orgs', orgId, 'assets'] as const,
    detail: (assetId: string) => ['assets', assetId] as const,
    replacement: (orgId: string) => ['orgs', orgId, 'replacement-plan'] as const,
    // Global reference data: not under an org, and cached for the session.
    categories: ['categories'] as const,
  },
  maintenance: {
    tasks: (orgId: string) => ['orgs', orgId, 'tasks'] as const,
    due: (orgId: string) => ['orgs', orgId, 'due'] as const,
  },
  vendors: {
    list: (orgId: string) => ['orgs', orgId, 'vendors'] as const,
  },
  documents: {
    list: (orgId: string) => ['orgs', orgId, 'documents'] as const,
  },
}
