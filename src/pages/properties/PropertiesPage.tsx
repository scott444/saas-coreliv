import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import type { AccessPoint, Property } from '@/domain'
import { useCurrentOrgId, useOrg } from '@/app/OrgProvider'
import {
  useAccessPoints,
  useDeleteAccessPoint,
  useDeleteLocation,
  useDeleteProperty,
  useLocations,
  useProperties,
  useSaveAccessPoint,
  useSaveLocation,
  useSaveProperty,
} from '@/hooks/useProperties'
import { useAssetRegister } from '@/hooks/useAssets'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PropertyFormDialog } from '@/components/properties/PropertyFormDialog'
import { formatDateOnly } from '@/lib/format'

const NONE = '__none__'

/** The kinds worth having a shortcut for; anything else can be typed. */
const ACCESS_KINDS = [
  { value: 'water_main', label: 'Water shutoff' },
  { value: 'gas_valve', label: 'Gas valve' },
  { value: 'breaker', label: 'Breaker' },
  { value: 'irrigation_drain', label: 'Irrigation drain' },
  { value: 'cleanout', label: 'Cleanout' },
  { value: 'other', label: 'Other' },
]

export function PropertiesPage() {
  const orgId = useCurrentOrgId()
  const { currentOrg } = useOrg()
  const canManage = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'

  const properties = useProperties(orgId)
  const saveProperty = useSaveProperty(orgId)
  const deleteProperty = useDeleteProperty(orgId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const active = properties.data?.find((p) => p.id === selectedId) ?? properties.data?.[0] ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Rooms, and the shutoffs you need to find in a hurry."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus /> Add property
            </Button>
          ) : undefined
        }
      />

      {properties.isPending ? (
        <LoadingState variant="cards" />
      ) : properties.error ? (
        <ErrorState
          error={properties.error}
          title="Could not load your properties"
          onRetry={() => void properties.refetch()}
        />
      ) : (properties.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Add the house first — everything else hangs off it."
          action={
            canManage ? (
              <Button
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
              >
                Add a property
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(properties.data ?? []).map((property) => (
              <Card
                key={property.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(property.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedId(property.id)}
                className={
                  property.id === active?.id
                    ? 'cursor-pointer ring-1 ring-foreground/20'
                    : 'cursor-pointer'
                }
              >
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="min-w-0 space-y-1">
                    <CardTitle>{property.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{property.address ?? 'No address'}</p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${property.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(property)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${property.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteProperty.mutate(property.id)
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{property.assetCount} assets</Badge>
                    {property.openItemCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/30 bg-destructive/10 text-destructive"
                      >
                        {property.openItemCount} overdue
                      </Badge>
                    ) : null}
                    {property.yearBuilt ? (
                      <Badge variant="outline">built {property.yearBuilt}</Badge>
                    ) : null}
                  </div>
                  {property.purchaseDate ? (
                    <p className="text-xs text-muted-foreground">
                      Bought {formatDateOnly(property.purchaseDate)}
                    </p>
                  ) : null}
                  {property.notes ? <p className="text-sm">{property.notes}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>

          {active ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <LocationsCard propertyId={active.id} propertyName={active.name} canEdit />
              <AccessPointsCard propertyId={active.id} canEdit />
            </div>
          ) : null}
        </>
      )}

      <PropertyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        property={editing}
        pending={saveProperty.isPending}
        error={saveProperty.error}
        onSubmit={(input) =>
          saveProperty.mutate(
            { propertyId: editing?.id, input },
            { onSuccess: () => setDialogOpen(false) },
          )
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

function LocationsCard({
  propertyId,
  propertyName,
  canEdit,
}: {
  propertyId: string
  propertyName: string
  canEdit: boolean
}) {
  const locations = useLocations(propertyId)
  const saveLocation = useSaveLocation(propertyId)
  const deleteLocation = useDeleteLocation(propertyId)
  const [name, setName] = useState('')
  const [floor, setFloor] = useState('')

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    saveLocation.mutate(
      { input: { name: name.trim(), floor: floor.trim() || null } },
      {
        onSuccess: () => {
          setName('')
          setFloor('')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-4" /> Rooms in {propertyName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {locations.isPending ? (
          <LoadingState variant="list" count={3} />
        ) : (locations.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rooms yet. They are optional, but they are how you find the thing later.
          </p>
        ) : (
          <ul className="divide-y">
            {(locations.data ?? []).map((location) => (
              <li key={location.id} className="flex items-center gap-3 py-2 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{location.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {location.floor ? `${location.floor} · ` : ''}
                    {location.assetCount} assets
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${location.name}`}
                    // Assets keep existing with no room rather than vanishing
                    // with it, so this is safe without a confirmation.
                    onClick={() => deleteLocation.mutate(location.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mechanical room"
              aria-label="Room name"
              className="min-w-40 flex-1"
            />
            <Input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="basement"
              aria-label="Floor"
              className="w-32"
            />
            <Button type="submit" variant="outline" loading={saveLocation.isPending} disabled={!name.trim()}>
              <Plus /> Add
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Access points
// ---------------------------------------------------------------------------

function AccessPointsCard({ propertyId, canEdit }: { propertyId: string; canEdit: boolean }) {
  const accessPoints = useAccessPoints(propertyId)
  const locations = useLocations(propertyId)
  const register = useAssetRegister(useCurrentOrgId())
  const save = useSaveAccessPoint(propertyId)
  const remove = useDeleteAccessPoint(propertyId)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AccessPoint | null>(null)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Shutoffs and access
        </CardTitle>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus /> Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {accessPoints.isPending ? (
          <LoadingState variant="list" count={3} />
        ) : (accessPoints.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing recorded. This is the list you want at 2am with water coming through a ceiling —
            where the main shutoff is, which breaker, which way the valve turns.
          </p>
        ) : (
          <ul className="divide-y">
            {(accessPoints.data ?? []).map((point) => (
              <li key={point.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">{point.label}</p>
                  {point.description ? <p className="text-sm">{point.description}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {[point.locationName, point.assetName].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(point)
                        setOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${point.label}`}
                      onClick={() => remove.mutate(point.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AccessPointDialog
        open={open}
        onOpenChange={setOpen}
        accessPoint={editing}
        locations={(locations.data ?? []).map((l) => ({ id: l.id, name: l.name }))}
        assets={(register.data ?? [])
          .filter((asset) => asset.propertyId === propertyId)
          .map((asset) => ({ id: asset.id, name: asset.name }))}
        pending={save.isPending}
        onSubmit={(input) => {
          save.mutate(
            { accessPointId: editing?.id, input },
            { onSuccess: () => setOpen(false) },
          )
        }}
      />
    </Card>
  )
}

function AccessPointDialog({
  open,
  onOpenChange,
  accessPoint,
  locations,
  assets,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  accessPoint: AccessPoint | null
  locations: Array<{ id: string; name: string }>
  assets: Array<{ id: string; name: string }>
  pending?: boolean
  onSubmit(input: {
    assetId: string | null
    locationId: string | null
    kind: string
    label: string
    description: string | null
    photoDocumentId: string | null
  }): void
}) {
  const [kind, setKind] = useState('water_main')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [locationId, setLocationId] = useState(NONE)
  const [assetId, setAssetId] = useState(NONE)

  useEffect(() => {
    if (!open) return
    setKind(accessPoint?.kind ?? 'water_main')
    setLabel(accessPoint?.label ?? '')
    setDescription(accessPoint?.description ?? '')
    setLocationId(accessPoint?.locationId ?? NONE)
    setAssetId(accessPoint?.assetId ?? NONE)
  }, [open, accessPoint])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      assetId: assetId === NONE ? null : assetId,
      locationId: locationId === NONE ? null : locationId,
      kind,
      label: label.trim(),
      description: description.trim() || null,
      photoDocumentId: null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{accessPoint ? 'Edit access point' : 'Add an access point'}</DialogTitle>
            <DialogDescription>
              Write the directions the way you would say them out loud to someone standing there.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ap-kind">Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="ap-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_KINDS.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-label">Label</Label>
              <Input
                id="ap-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Main water shutoff"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-location">Room</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="ap-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-asset">Controls</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger id="ap-asset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ap-description">Where and how</Label>
              <Textarea
                id="ap-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mechanical room, north wall behind the furnace. Red lever, quarter turn clockwise."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!label.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
