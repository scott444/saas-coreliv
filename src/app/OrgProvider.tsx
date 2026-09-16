import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Organization } from '@/domain'
import { useServices } from './ServicesProvider'
import { queryKeys } from './queryKeys'

const STORAGE_KEY = 'coreliv.currentOrgId'

interface OrgContextValue {
  organizations: Organization[]
  currentOrg: Organization | null
  isLoading: boolean
  error: unknown
  setCurrentOrgId(orgId: string): void
  refetch(): void
}

const OrgContext = createContext<OrgContextValue | null>(null)

function readStoredOrgId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { organizations: orgService } = useServices()
  const [selectedId, setSelectedId] = useState<string | null>(readStoredOrgId)

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.all,
    queryFn: () => orgService.list(),
    staleTime: 5 * 60_000,
  })

  const organizations = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data])
  const currentOrg = organizations.find((o) => o.id === selectedId) ?? organizations[0] ?? null

  useEffect(() => {
    if (currentOrg && currentOrg.id !== selectedId) setSelectedId(currentOrg.id)
  }, [currentOrg, selectedId])

  const value = useMemo<OrgContextValue>(
    () => ({
      organizations,
      currentOrg,
      isLoading: orgsQuery.isPending,
      error: orgsQuery.error,
      setCurrentOrgId(orgId) {
        setSelectedId(orgId)
        try {
          localStorage.setItem(STORAGE_KEY, orgId)
        } catch {
          /* ignore */
        }
      },
      refetch: () => void orgsQuery.refetch(),
    }),
    [organizations, currentOrg, orgsQuery],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside <OrgProvider>')
  return ctx
}

/** Convenience for pages that require an org to be selected. */
export function useCurrentOrgId(): string {
  const { currentOrg } = useOrg()
  if (!currentOrg) throw new Error('No organization selected')
  return currentOrg.id
}
