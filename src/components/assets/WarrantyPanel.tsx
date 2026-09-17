import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Vendor, Warranty, WarrantyInput, WarrantyKind } from '@/domain'
import { WARRANTY_KINDS, WARRANTY_KIND_LABELS, warrantySummary } from '@/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/states'
import { formatDateOnly } from '@/lib/format'
import { errorMessage } from '@/lib/errorMessage'
import { WarrantyBadge } from './StatusBadges'

const NONE = '__none__'

interface WarrantyPanelProps {
  warranties: Warranty[]
  vendors: Vendor[]
  canEdit: boolean
  onSave(args: { warrantyId?: string; input: WarrantyInput }): void
  onDelete(warrantyId: string): void
  pending?: boolean
  error?: unknown
}

export function WarrantyPanel({
  warranties,
  vendors,
  canEdit,
  onSave,
  onDelete,
  pending,
  error,
}: WarrantyPanelProps) {
  const [editing, setEditing] = useState<Warranty | null>(null)
  const [open, setOpen] = useState(false)

  const openNew = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (warranty: Warranty) => {
    setEditing(warranty)
    setOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Warranties</CardTitle>
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus /> Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {warranties.length === 0 ? (
          <EmptyState
            title="No warranty recorded"
            description="Not the same as out of warranty — until something is entered here, the register counts this asset as undocumented."
            action={canEdit ? <Button size="sm" onClick={openNew}>Add a warranty</Button> : undefined}
          />
        ) : (
          <ul className="divide-y">
            {warranties.map((warranty) => (
              <li key={warranty.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{WARRANTY_KIND_LABELS[warranty.kind]}</span>
                    <WarrantyBadge summary={warrantySummary(warranty)} />
                    {warranty.registered ? null : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        not registered
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateOnly(warranty.startDate)} —{' '}
                    {warranty.endDate ? formatDateOnly(warranty.endDate) : 'lifetime'}
                    {warranty.providerName ? ` · ${warranty.providerName}` : ''}
                  </p>
                  {warranty.coverageNotes ? (
                    <p className="text-sm">{warranty.coverageNotes}</p>
                  ) : null}
                  {warranty.registrationRef || warranty.claimPhone ? (
                    <p className="text-xs text-muted-foreground">
                      {warranty.registrationRef ? `Ref ${warranty.registrationRef}` : ''}
                      {warranty.registrationRef && warranty.claimPhone ? ' · ' : ''}
                      {warranty.claimPhone ? `Claims ${warranty.claimPhone}` : ''}
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(warranty)}>
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${WARRANTY_KIND_LABELS[warranty.kind]} warranty`}
                      onClick={() => onDelete(warranty.id)}
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

      <WarrantyDialog
        open={open}
        onOpenChange={setOpen}
        warranty={editing}
        vendors={vendors}
        pending={pending}
        error={error}
        onSubmit={(input) => {
          onSave(editing ? { warrantyId: editing.id, input } : { input })
          setOpen(false)
        }}
      />
    </Card>
  )
}

function WarrantyDialog({
  open,
  onOpenChange,
  warranty,
  vendors,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  warranty: Warranty | null
  vendors: Vendor[]
  pending?: boolean
  error?: unknown
  onSubmit(input: WarrantyInput): void
}) {
  const [kind, setKind] = useState<WarrantyKind>('manufacturer_parts')
  const [providerId, setProviderId] = useState(NONE)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [lifetime, setLifetime] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [registrationRef, setRegistrationRef] = useState('')
  const [transferable, setTransferable] = useState(false)
  const [coverageNotes, setCoverageNotes] = useState('')
  const [claimPhone, setClaimPhone] = useState('')

  useEffect(() => {
    if (!open) return
    setKind(warranty?.kind ?? 'manufacturer_parts')
    setProviderId(warranty?.providerId ?? NONE)
    setStartDate(warranty?.startDate ?? new Date().toISOString().slice(0, 10))
    setEndDate(warranty?.endDate ?? '')
    setLifetime(warranty ? warranty.endDate === null : false)
    setRegistered(warranty?.registered ?? false)
    setRegistrationRef(warranty?.registrationRef ?? '')
    setTransferable(warranty?.transferable ?? false)
    setCoverageNotes(warranty?.coverageNotes ?? '')
    setClaimPhone(warranty?.claimPhone ?? '')
  }, [open, warranty])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      kind,
      providerId: providerId === NONE ? null : providerId,
      startDate,
      // Lifetime is a null end date, not a far-future one, so the badge can
      // say "lifetime" rather than counting down to a made-up year.
      endDate: lifetime ? null : endDate || null,
      registered,
      registrationRef: registrationRef.trim() || null,
      transferable,
      coverageNotes: coverageNotes.trim() || null,
      claimPhone: claimPhone.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{warranty ? 'Edit warranty' : 'Add a warranty'}</DialogTitle>
            <DialogDescription>
              An asset can carry several at once — parts, labour, and an extended plan on top.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save the warranty')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="warranty-kind">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as WarrantyKind)}>
                <SelectTrigger id="warranty-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WARRANTY_KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {WARRANTY_KIND_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warranty-provider">Provider</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger id="warranty-provider">
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
              <Label htmlFor="warranty-start">Starts</Label>
              <Input
                id="warranty-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="warranty-end">Ends</Label>
              <Input
                id="warranty-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={lifetime}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={lifetime} onCheckedChange={setLifetime} /> Lifetime cover
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={registered} onCheckedChange={setRegistered} /> Registered
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={transferable} onCheckedChange={setTransferable} /> Transferable
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="warranty-ref">Registration reference</Label>
              <Input
                id="warranty-ref"
                value={registrationRef}
                onChange={(e) => setRegistrationRef(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warranty-phone">Claims phone</Label>
              <Input
                id="warranty-phone"
                value={claimPhone}
                onChange={(e) => setClaimPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="warranty-notes">What it covers</Label>
            <Textarea
              id="warranty-notes"
              rows={2}
              value={coverageNotes}
              onChange={(e) => setCoverageNotes(e.target.value)}
              placeholder="Compressor 10 years, other parts 5"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!startDate}>
              {warranty ? 'Save changes' : 'Add warranty'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
