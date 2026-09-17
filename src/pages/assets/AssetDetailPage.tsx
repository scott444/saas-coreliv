import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import {
  bestWarranty,
  formatServiceAge,
  LIFECYCLE_LABELS,
  lifecycleState,
  monthsInService,
} from '@/domain'
import { useCurrentOrgId } from '@/app/OrgProvider'
import {
  useAddDocument,
  useAddServiceEvent,
  useAsset,
  useCategories,
  useDeleteAsset,
  useDeleteConsumable,
  useDeleteDocument,
  useDeleteServiceEvent,
  useDeleteWarranty,
  useDeleteZone,
  useSaveConsumable,
  useSaveWarranty,
  useSaveZone,
  useUpdateAsset,
} from '@/hooks/useAssets'
import { useLocations, useProperties } from '@/hooks/useProperties'
import { useVendors } from '@/hooks/useVendors'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AssetFormDialog } from '@/components/assets/AssetFormDialog'
import { SpecList } from '@/components/assets/SpecFields'
import { AssetStatusBadge, WarrantyBadge } from '@/components/assets/StatusBadges'
import { WarrantyPanel } from '@/components/assets/WarrantyPanel'
import { ConsumablePanel } from '@/components/assets/ConsumablePanel'
import { ServiceLogPanel } from '@/components/assets/ServiceLogPanel'
import { DocumentPanel } from '@/components/assets/DocumentPanel'
import { ZonePanel } from '@/components/assets/ZonePanel'
import { formatCurrency, formatDateOnly } from '@/lib/format'

export function AssetDetailPage() {
  const { assetId = '' } = useParams()
  const orgId = useCurrentOrgId()
  const navigate = useNavigate()

  const detail = useAsset(assetId)
  const categories = useCategories()
  const properties = useProperties(orgId)
  const vendors = useVendors(orgId)
  const locations = useLocations(detail.data?.asset.propertyId ?? null)

  const [editOpen, setEditOpen] = useState(false)
  const updateAsset = useUpdateAsset(orgId, assetId)
  const deleteAsset = useDeleteAsset(orgId)

  const saveWarranty = useSaveWarranty(orgId, assetId)
  const deleteWarranty = useDeleteWarranty(orgId, assetId)
  const saveConsumable = useSaveConsumable(orgId, assetId)
  const deleteConsumable = useDeleteConsumable(orgId, assetId)
  const addEvent = useAddServiceEvent(orgId, assetId)
  const deleteEvent = useDeleteServiceEvent(orgId, assetId)
  const addDocument = useAddDocument(orgId, assetId)
  const deleteDocument = useDeleteDocument(orgId, assetId)
  const saveZone = useSaveZone(orgId, assetId)
  const deleteZone = useDeleteZone(orgId, assetId)

  if (detail.isPending) return <LoadingState variant="page" />
  if (detail.error) {
    return (
      <ErrorState
        error={detail.error}
        title="Could not load that asset"
        onRetry={() => void detail.refetch()}
      />
    )
  }

  const { asset, category, groupName, location, property, parent, children, replacement } = detail.data
  const warranty = bestWarranty(detail.data.warranties)
  const lifecycle = lifecycleState(replacement)
  const age = monthsInService(asset.installDate ?? asset.purchaseDate)
  const isIrrigationController = category?.slug === 'irrigation-controller'

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/assets">
          <ArrowLeft /> Register
        </Link>
      </Button>

      <PageHeader
        eyebrow={
          <p className="text-sm text-muted-foreground">
            {property.name}
            {location ? ` · ${location.name}` : ''}
            {groupName && category ? ` · ${groupName} › ${category.name}` : ''}
          </p>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {asset.name}
            <AssetStatusBadge status={asset.status} />
          </span>
        }
        description={[asset.brand, asset.modelNumber].filter(Boolean).join(' ') || undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="ghost"
              aria-label={`Delete ${asset.name}`}
              loading={deleteAsset.isPending}
              onClick={() => {
                deleteAsset.mutate(assetId, { onSuccess: () => navigate('/assets') })
              }}
            >
              <Trash2 />
            </Button>
          </>
        }
      />

      {/* The four facts you would otherwise dig for: what it is, how old it
          is, whether it is covered, and what it has cost. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Serial">
          <span className="font-mono text-sm">{asset.serialNumber ?? '—'}</span>
        </SummaryCard>
        <SummaryCard label="In service">
          <span className="text-lg font-semibold">{formatServiceAge(age)}</span>
          <p className="text-xs text-muted-foreground">
            {asset.installDate
              ? `installed ${formatDateOnly(asset.installDate)}`
              : asset.purchaseDate
                ? `bought ${formatDateOnly(asset.purchaseDate)}`
                : 'no date recorded'}
          </p>
        </SummaryCard>
        <SummaryCard label="Warranty">
          <WarrantyBadge summary={warranty} />
        </SummaryCard>
        <SummaryCard label="Spent so far">
          <span className="text-lg font-semibold tabular-nums">
            {formatCurrency(replacement.acquisitionCost + replacement.lifetimeServiceCost)}
          </span>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(replacement.acquisitionCost)} to buy ·{' '}
            {formatCurrency(replacement.lifetimeServiceCost)} in service
          </p>
        </SummaryCard>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="warranty">Warranty ({detail.data.warranties.length})</TabsTrigger>
          <TabsTrigger value="upkeep">Upkeep ({detail.data.consumables.length})</TabsTrigger>
          <TabsTrigger value="history">History ({detail.data.events.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({detail.data.documents.length})</TabsTrigger>
          {isIrrigationController ? (
            <TabsTrigger value="zones">Zones ({detail.data.irrigationZones.length})</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{category ? `${category.name} specifics` : 'Specifics'}</CardTitle>
              </CardHeader>
              <CardContent>
                <SpecList schema={category?.specSchema ?? []} value={asset.specs} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Replacement planning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{LIFECYCLE_LABELS[lifecycle]}</p>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Field label="Expected life">
                    {replacement.expectedLifespanYears
                      ? `${replacement.expectedLifespanYears} years`
                      : 'not recorded'}
                  </Field>
                  <Field label="Projected replacement">
                    {replacement.projectedReplacement
                      ? formatDateOnly(replacement.projectedReplacement)
                      : '—'}
                  </Field>
                  <Field label="Bought from">{detail.data.retailer?.name ?? '—'}</Field>
                  <Field label="Installed by">{detail.data.installer?.name ?? '—'}</Field>
                </dl>
              </CardContent>
            </Card>
          </div>

          {asset.notes || asset.description || asset.tags.length > 0 || parent || children.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {asset.description ? <p className="text-sm">{asset.description}</p> : null}
                {asset.notes ? <p className="whitespace-pre-wrap text-sm">{asset.notes}</p> : null}
                {parent ? (
                  <p className="text-sm text-muted-foreground">
                    Part of{' '}
                    <Link to={`/assets/${parent.id}`} className="underline underline-offset-4">
                      {parent.name}
                    </Link>
                  </p>
                ) : null}
                {children.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Includes{' '}
                    {children.map((child, index) => (
                      <span key={child.id}>
                        {index > 0 ? ', ' : ''}
                        <Link to={`/assets/${child.id}`} className="underline underline-offset-4">
                          {child.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
                {asset.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="warranty">
          <WarrantyPanel
            warranties={detail.data.warranties}
            vendors={vendors.data ?? []}
            canEdit
            pending={saveWarranty.isPending}
            error={saveWarranty.error}
            onSave={(args) => saveWarranty.mutate(args)}
            onDelete={(warrantyId) => deleteWarranty.mutate(warrantyId)}
          />
        </TabsContent>

        <TabsContent value="upkeep">
          <ConsumablePanel
            consumables={detail.data.consumables}
            canEdit
            pending={saveConsumable.isPending}
            error={saveConsumable.error}
            onSave={(args) => saveConsumable.mutate(args)}
            onDelete={(consumableId) => deleteConsumable.mutate(consumableId)}
          />
        </TabsContent>

        <TabsContent value="history">
          <ServiceLogPanel
            events={detail.data.events}
            vendors={vendors.data ?? []}
            canEdit
            pending={addEvent.isPending}
            error={addEvent.error}
            onAdd={(input) => addEvent.mutate(input)}
            onDelete={(eventId) => deleteEvent.mutate(eventId)}
          />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentPanel
            documents={detail.data.documents}
            canEdit
            pending={addDocument.isPending}
            error={addDocument.error}
            onAdd={(input) =>
              addDocument.mutate({
                propertyId: asset.propertyId,
                input: { ...input, assetId },
              })
            }
            onDelete={(documentId) => deleteDocument.mutate(documentId)}
          />
        </TabsContent>

        {isIrrigationController ? (
          <TabsContent value="zones">
            <ZonePanel
              zones={detail.data.irrigationZones}
              canEdit
              pending={saveZone.isPending}
              error={saveZone.error}
              onSave={(input) => saveZone.mutate(input)}
              onDelete={(zoneId) => deleteZone.mutate(zoneId)}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <AssetFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        asset={asset}
        properties={properties.data ?? []}
        categories={categories.data ?? []}
        locations={locations.data ?? []}
        vendors={vendors.data ?? []}
        propertyId={asset.propertyId}
        onPropertyChange={() => {}}
        pending={updateAsset.isPending}
        error={updateAsset.error}
        onSubmit={(input) => updateAsset.mutate(input, { onSuccess: () => setEditOpen(false) })}
      />
    </div>
  )
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}
