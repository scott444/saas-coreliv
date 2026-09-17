import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Asset, AssetInput, AssetStatus, Category, Location, Property, Specs, Vendor } from '@/domain'
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from '@/domain'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { errorMessage } from '@/lib/errorMessage'
import { SpecFields } from './SpecFields'

const NONE = '__none__'

interface AssetFormDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  /** Absent when creating. */
  asset?: Asset
  properties: Property[]
  categories: Category[]
  locations: Location[]
  vendors: Vendor[]
  /** The property to file a new asset under; also drives the room list. */
  propertyId: string | null
  onPropertyChange(propertyId: string): void
  pending?: boolean
  error?: unknown
  onSubmit(input: AssetInput): void
}

interface FormState {
  name: string
  categoryId: string
  locationId: string
  brand: string
  modelNumber: string
  serialNumber: string
  description: string
  purchaseDate: string
  installDate: string
  manufactureDate: string
  purchaseCost: string
  installCost: string
  retailerId: string
  installerId: string
  expectedLifespanYears: string
  status: AssetStatus
  tags: string
  notes: string
}

const BLANK: FormState = {
  name: '',
  categoryId: NONE,
  locationId: NONE,
  brand: '',
  modelNumber: '',
  serialNumber: '',
  description: '',
  purchaseDate: '',
  installDate: '',
  manufactureDate: '',
  purchaseCost: '',
  installCost: '',
  retailerId: NONE,
  installerId: NONE,
  expectedLifespanYears: '',
  status: 'active',
  tags: '',
  notes: '',
}

function fromAsset(asset: Asset): FormState {
  return {
    name: asset.name,
    categoryId: asset.categoryId ?? NONE,
    locationId: asset.locationId ?? NONE,
    brand: asset.brand ?? '',
    modelNumber: asset.modelNumber ?? '',
    serialNumber: asset.serialNumber ?? '',
    description: asset.description ?? '',
    purchaseDate: asset.purchaseDate ?? '',
    installDate: asset.installDate ?? '',
    manufactureDate: asset.manufactureDate ?? '',
    purchaseCost: asset.purchaseCost === null ? '' : String(asset.purchaseCost),
    installCost: asset.installCost === null ? '' : String(asset.installCost),
    retailerId: asset.retailerId ?? NONE,
    installerId: asset.installerId ?? NONE,
    expectedLifespanYears:
      asset.expectedLifespanYears === null ? '' : String(asset.expectedLifespanYears),
    status: asset.status,
    tags: asset.tags.join(', '),
    notes: asset.notes ?? '',
  }
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
const idOrNull = (value: string) => (value === NONE ? null : value)
const numberOrNull = (value: string) => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  properties,
  categories,
  locations,
  vendors,
  propertyId,
  onPropertyChange,
  pending,
  error,
  onSubmit,
}: AssetFormDialogProps) {
  const [form, setForm] = useState<FormState>(BLANK)
  const [specs, setSpecs] = useState<Specs>({})

  useEffect(() => {
    if (!open) return
    setForm(asset ? fromAsset(asset) : BLANK)
    setSpecs(asset ? asset.specs : {})
  }, [open, asset])

  // Categories arrive flat; group them for the select so "Furnace" appears
  // under "HVAC" rather than in an alphabetical wall of forty items.
  const grouped = useMemo(() => {
    const roots = categories.filter((c) => c.parentId === null)
    return roots
      .map((root) => ({
        group: root,
        children: categories
          .filter((c) => c.parentId === root.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((entry) => entry.children.length > 0)
      .sort((a, b) => a.group.sortOrder - b.group.sortOrder)
  }, [categories])

  const selectedCategory = categories.find((c) => c.id === form.categoryId) ?? null

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      categoryId: idOrNull(form.categoryId),
      locationId: idOrNull(form.locationId),
      // Re-parenting is done from the asset page, not this form.
      parentAssetId: asset?.parentAssetId ?? null,
      name: form.name.trim(),
      brand: orNull(form.brand),
      modelNumber: orNull(form.modelNumber),
      serialNumber: orNull(form.serialNumber),
      description: orNull(form.description),
      purchaseDate: orNull(form.purchaseDate),
      installDate: orNull(form.installDate),
      manufactureDate: orNull(form.manufactureDate),
      purchaseCost: numberOrNull(form.purchaseCost),
      installCost: numberOrNull(form.installCost),
      retailerId: idOrNull(form.retailerId),
      installerId: idOrNull(form.installerId),
      expectedLifespanYears: numberOrNull(form.expectedLifespanYears),
      status: form.status,
      replacedById: asset?.replacedById ?? null,
      retiredAt: asset?.retiredAt ?? null,
      specs,
      notes: orNull(form.notes),
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{asset ? 'Edit asset' : 'Add an asset'}</DialogTitle>
            <DialogDescription>
              Anything with a make, model or serial worth writing down. Only a name is required —
              the rest can be filled in as you find it.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save the asset')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Upstairs furnace"
                required
                autoFocus
              />
            </div>

            {!asset ? (
              <div className="space-y-2">
                <Label htmlFor="asset-property">Property</Label>
                <Select value={propertyId ?? NONE} onValueChange={onPropertyChange}>
                  <SelectTrigger id="asset-property">
                    <SelectValue placeholder="Choose a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="asset-category">Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => set('categoryId', v)}>
                <SelectTrigger id="asset-category">
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Uncategorised</SelectItem>
                  {grouped.map(({ group, children }) => (
                    <SelectGroup key={group.id}>
                      <SelectLabel>{group.name}</SelectLabel>
                      {children.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-location">Room or area</Label>
              <Select value={form.locationId} onValueChange={(v) => set('locationId', v)}>
                <SelectTrigger id="asset-location">
                  <SelectValue placeholder="Not set" />
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
              <Label htmlFor="asset-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as AssetStatus)}>
                <SelectTrigger id="asset-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ASSET_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Identification</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="asset-brand">Make</Label>
                <Input id="asset-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Carrier" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-model">Model</Label>
                <Input id="asset-model" value={form.modelNumber} onChange={(e) => set('modelNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-serial">Serial</Label>
                <Input id="asset-serial" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Dates and cost</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="asset-install">Installed</Label>
                <Input id="asset-install" type="date" value={form.installDate} onChange={(e) => set('installDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-purchase">Purchased</Label>
                <Input id="asset-purchase" type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-manufacture">Manufactured</Label>
                <Input id="asset-manufacture" type="date" value={form.manufactureDate} onChange={(e) => set('manufactureDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-purchase-cost">Purchase cost</Label>
                <Input id="asset-purchase-cost" type="number" min="0" step="0.01" value={form.purchaseCost} onChange={(e) => set('purchaseCost', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-install-cost">Install cost</Label>
                <Input id="asset-install-cost" type="number" min="0" step="0.01" value={form.installCost} onChange={(e) => set('installCost', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-lifespan">Expected life (years)</Label>
                <Input id="asset-lifespan" type="number" min="0" step="1" value={form.expectedLifespanYears} onChange={(e) => set('expectedLifespanYears', e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Who supplied it</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asset-retailer">Bought from</Label>
                <Select value={form.retailerId} onValueChange={(v) => set('retailerId', v)}>
                  <SelectTrigger id="asset-retailer">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not set</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-installer">Installed by</Label>
                <Select value={form.installerId} onValueChange={(v) => set('installerId', v)}>
                  <SelectTrigger id="asset-installer">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not set</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-medium">
              {selectedCategory ? `${selectedCategory.name} specifics` : 'Specifics'}
            </h3>
            <SpecFields
              schema={selectedCategory?.specSchema ?? []}
              value={specs}
              onChange={setSpecs}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="asset-tags">Tags</Label>
              <Input
                id="asset-tags"
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder="gas, replace-soon, sale_disclosure"
              />
              <p className="text-xs text-muted-foreground">Comma separated.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-notes">Notes</Label>
              <Textarea
                id="asset-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Where the filter slot is, which breaker it is on, anything you would otherwise forget."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={pending}
              disabled={!form.name.trim() || (!asset && !propertyId)}
            >
              {asset ? 'Save changes' : 'Add asset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
