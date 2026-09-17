import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useCurrentOrgId, useOrg } from '@/app/OrgProvider'
import { useAssetRegister, useCategories, useCreateAsset } from '@/hooks/useAssets'
import { useLocations, useProperties } from '@/hooks/useProperties'
import { useVendors } from '@/hooks/useVendors'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AssetTable } from '@/components/assets/AssetTable'
import { AssetFormDialog } from '@/components/assets/AssetFormDialog'
import { RegisterSummaryTiles } from '@/components/assets/RegisterSummaryTiles'
import {
  EMPTY_FILTER,
  filterAssets,
  sortAssets,
  summarize,
  type RegisterFilter,
  type SortKey,
} from '@/components/assets/registerFilter'

const ALL = '__all__'

export function AssetsPage() {
  const orgId = useCurrentOrgId()
  const { currentOrg } = useOrg()
  const canEdit = currentOrg !== null

  const register = useAssetRegister(orgId)
  const properties = useProperties(orgId)
  const categories = useCategories()
  const vendors = useVendors(orgId)

  const [filter, setFilter] = useState<RegisterFilter>(EMPTY_FILTER)
  const [sortKey, setSortKey] = useState<SortKey>('property')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newAssetPropertyId, setNewAssetPropertyId] = useState<string | null>(null)
  const locations = useLocations(newAssetPropertyId)
  const createAsset = useCreateAsset(orgId)

  const entries = useMemo(() => register.data ?? [], [register.data])
  const summary = useMemo(() => summarize(entries), [entries])
  const visible = useMemo(
    () => sortAssets(filterAssets(entries, filter), sortKey, sortDirection),
    [entries, filter, sortKey, sortDirection],
  )

  // Only leaf categories that something is actually filed under, so the
  // dropdown is a picture of this house rather than the whole taxonomy.
  const usedCategories = useMemo(() => {
    const seen = new Map<string, string>()
    for (const entry of entries) {
      if (entry.categoryId && entry.categoryName) seen.set(entry.categoryId, entry.categoryName)
    }
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]))
  }, [entries])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const openCreate = () => {
    setNewAssetPropertyId(filter.propertyId ?? properties.data?.[0]?.id ?? null)
    setDialogOpen(true)
  }

  const isFiltered =
    filter.search !== '' || filter.propertyId !== null || filter.categoryId !== null || filter.tile !== null

  const multipleProperties = (properties.data?.length ?? 0) > 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Register"
        description="Everything in the house with a make, model or serial worth writing down."
        actions={
          canEdit && (properties.data?.length ?? 0) > 0 ? (
            <Button onClick={openCreate}>
              <Plus /> Add asset
            </Button>
          ) : undefined
        }
      />

      {register.isPending ? (
        <LoadingState variant="page" />
      ) : register.error ? (
        <ErrorState
          error={register.error}
          title="Could not load the register"
          onRetry={() => void register.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description={
            (properties.data?.length ?? 0) === 0
              ? 'Add a property first — every asset is filed under one.'
              : 'Start with the things you would have to find a serial number for: the furnace, the water heater, the roof.'
          }
          action={
            canEdit && (properties.data?.length ?? 0) > 0 ? (
              <Button onClick={openCreate}>
                <Plus /> Add the first one
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <RegisterSummaryTiles
            summary={summary}
            active={filter.tile}
            onSelect={(tile) => setFilter((f) => ({ ...f, tile }))}
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter.search}
                onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search make, model, serial, room, tag…"
                className="pl-9"
                aria-label="Search the register"
              />
            </div>

            {multipleProperties ? (
              <Select
                value={filter.propertyId ?? ALL}
                onValueChange={(v) =>
                  setFilter((f) => ({ ...f, propertyId: v === ALL ? null : v }))
                }
              >
                <SelectTrigger className="w-44" aria-label="Filter by property">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All properties</SelectItem>
                  {(properties.data ?? []).map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <Select
              value={filter.categoryId ?? ALL}
              onValueChange={(v) => setFilter((f) => ({ ...f, categoryId: v === ALL ? null : v }))}
            >
              <SelectTrigger className="w-44" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {usedCategories.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isFiltered ? (
              <Button variant="ghost" onClick={() => setFilter(EMPTY_FILTER)}>
                <X /> Clear
              </Button>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            {visible.length === entries.length
              ? `${entries.length} assets`
              : `${visible.length} of ${entries.length} assets`}
          </p>

          {visible.length === 0 ? (
            <EmptyState
              title="Nothing matches"
              description="Try a different search, or clear the filters."
              action={
                <Button variant="outline" onClick={() => setFilter(EMPTY_FILTER)}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <AssetTable
              entries={visible}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              showProperty={multipleProperties}
            />
          )}
        </>
      )}

      <AssetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        properties={properties.data ?? []}
        categories={categories.data ?? []}
        locations={locations.data ?? []}
        vendors={vendors.data ?? []}
        propertyId={newAssetPropertyId}
        onPropertyChange={setNewAssetPropertyId}
        pending={createAsset.isPending}
        error={createAsset.error}
        onSubmit={(input) => {
          if (!newAssetPropertyId) return
          createAsset.mutate(
            { propertyId: newAssetPropertyId, input },
            { onSuccess: () => setDialogOpen(false) },
          )
        }}
      />
    </div>
  )
}
