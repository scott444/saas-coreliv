import { useMemo, useState } from 'react'
import { Cpu, Search } from 'lucide-react'
import { summarizeRegister } from '@/domain'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { useHardwareRegister } from '@/hooks/useSystems'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { HardwareRegisterTable } from '@/components/hardware/HardwareRegisterTable'
import { RegisterSummaryTiles } from '@/components/hardware/RegisterSummaryTiles'
import { ALL_HOMES, filterRegister, registerHomes, type RegisterFocus } from '@/components/hardware/registerFilter'
import { PageHeader } from '@/components/layout/PageHeader'

export function HardwareRegisterPage() {
  const orgId = useCurrentOrgId()
  const register = useHardwareRegister(orgId)

  const [query, setQuery] = useState('')
  const [homeId, setHomeId] = useState<string>(ALL_HOMES)
  const [focus, setFocus] = useState<RegisterFocus>('all')

  const entries = useMemo(() => register.data ?? [], [register.data])

  // The summary counts the whole register, not the filtered view - the tiles are
  // the filter control, so they have to keep showing what is there to filter to.
  const summary = useMemo(() => summarizeRegister(entries), [entries])

  const homes = useMemo(() => registerHomes(entries), [entries])
  const visible = useMemo(() => filterRegister(entries, { query, homeId, focus }), [entries, homeId, focus, query])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hardware"
        description="Every device across your homes, with the details you need for a service call or warranty claim."
      />

      {register.isPending ? (
        <LoadingState variant="list" count={5} />
      ) : register.isError ? (
        <ErrorState error={register.error} title="Could not load the hardware register" onRetry={() => void register.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Cpu className="size-6" />}
          title="No systems yet"
          description="Add a home and its systems, then record what hardware is installed."
        />
      ) : (
        <>
          <RegisterSummaryTiles summary={summary} focus={focus} onFocusChange={setFocus} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="register-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="register-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Manufacturer, model, serial or device name"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2 sm:w-56">
              <Label htmlFor="register-home">Home</Label>
              <Select value={homeId} onValueChange={setHomeId}>
                <SelectTrigger id="register-home">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_HOMES}>All homes</SelectItem>
                  {homes.map((home) => (
                    <SelectItem key={home.id} value={home.id}>
                      {home.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {visible.length === 0 ? (
                <EmptyState
                  icon={<Search className="size-6" />}
                  title="Nothing matches those filters"
                  description="Try a different search, home or summary tile."
                  className="m-5"
                />
              ) : (
                <HardwareRegisterTable entries={visible} />
              )}
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground" role="status">
            Showing {visible.length} of {entries.length} devices
          </p>
        </>
      )}
    </div>
  )
}
