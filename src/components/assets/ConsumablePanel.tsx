import { useEffect, useState, type FormEvent } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import type { Consumable, ConsumableInput, RecurrenceUnit } from '@/domain'
import { RECURRENCE_UNITS, addInterval, describeInterval, dueStatus, daysFromToday } from '@/domain'
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
import { formatCurrency, formatDateOnly } from '@/lib/format'
import { errorMessage } from '@/lib/errorMessage'
import { DueBadge } from './StatusBadges'

interface ConsumablePanelProps {
  consumables: Consumable[]
  canEdit: boolean
  onSave(args: { consumableId?: string; input: ConsumableInput }): void
  onDelete(consumableId: string): void
  pending?: boolean
  error?: unknown
}

/** The projected next-due date, mirroring the server's `add_interval`. */
function nextDue(consumable: Consumable): string | null {
  if (!consumable.lastReplacedOn || !consumable.intervalValue || !consumable.intervalUnit) {
    return null
  }
  return addInterval(consumable.lastReplacedOn, consumable.intervalValue, consumable.intervalUnit)
}

export function ConsumablePanel({
  consumables,
  canEdit,
  onSave,
  onDelete,
  pending,
  error,
}: ConsumablePanelProps) {
  const [editing, setEditing] = useState<Consumable | null>(null)
  const [open, setOpen] = useState(false)

  const openNew = () => {
    setEditing(null)
    setOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Consumables</CardTitle>
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus /> Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {consumables.length === 0 ? (
          <EmptyState
            title="Nothing to replace"
            description="Filters, bulbs, batteries, softener salt, anode rods — anything that runs out and has a size you have to match."
            action={canEdit ? <Button size="sm" onClick={openNew}>Add a consumable</Button> : undefined}
          />
        ) : (
          <ul className="divide-y">
            {consumables.map((consumable) => {
              const due = nextDue(consumable)
              return (
                <li key={consumable.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{consumable.name}</span>
                      {due ? (
                        <DueBadge status={dueStatus(due)} days={daysFromToday(due)} />
                      ) : null}
                      {/* Stock is the thing you want to know before driving to
                          the shop, so it sits next to the name, not in a note. */}
                      <span className="text-xs text-muted-foreground">
                        {consumable.quantityOnHand > 0
                          ? `${consumable.quantityOnHand} on hand`
                          : 'none on hand'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {consumable.sizeOrSpec ?? 'No size recorded'}
                      {consumable.partNumber ? ` · ${consumable.partNumber}` : ''}
                      {consumable.unitCost !== null ? ` · ${formatCurrency(consumable.unitCost)}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {consumable.intervalValue && consumable.intervalUnit
                        ? describeInterval(consumable.intervalValue, consumable.intervalUnit)
                        : 'no schedule'}
                      {consumable.lastReplacedOn
                        ? ` · last changed ${formatDateOnly(consumable.lastReplacedOn)}`
                        : ' · never changed'}
                      {due ? ` · next ${formatDateOnly(due)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {consumable.reorderUrl ? (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={consumable.reorderUrl} target="_blank" rel="noreferrer noopener">
                          Reorder <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(consumable)
                            setOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${consumable.name}`}
                          onClick={() => onDelete(consumable.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <ConsumableDialog
        open={open}
        onOpenChange={setOpen}
        consumable={editing}
        pending={pending}
        error={error}
        onSubmit={(input) => {
          onSave(editing ? { consumableId: editing.id, input } : { input })
          setOpen(false)
        }}
      />
    </Card>
  )
}

function ConsumableDialog({
  open,
  onOpenChange,
  consumable,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  consumable: Consumable | null
  pending?: boolean
  error?: unknown
  onSubmit(input: ConsumableInput): void
}) {
  const [name, setName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [sizeOrSpec, setSizeOrSpec] = useState('')
  const [intervalValue, setIntervalValue] = useState('')
  const [intervalUnit, setIntervalUnit] = useState<RecurrenceUnit>('month')
  const [lastReplacedOn, setLastReplacedOn] = useState('')
  const [quantityOnHand, setQuantityOnHand] = useState('0')
  const [reorderUrl, setReorderUrl] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setName(consumable?.name ?? '')
    setPartNumber(consumable?.partNumber ?? '')
    setSizeOrSpec(consumable?.sizeOrSpec ?? '')
    setIntervalValue(consumable?.intervalValue ? String(consumable.intervalValue) : '')
    setIntervalUnit(consumable?.intervalUnit ?? 'month')
    setLastReplacedOn(consumable?.lastReplacedOn ?? '')
    setQuantityOnHand(String(consumable?.quantityOnHand ?? 0))
    setReorderUrl(consumable?.reorderUrl ?? '')
    setUnitCost(consumable?.unitCost === null || consumable === null ? '' : String(consumable.unitCost))
    setNotes(consumable?.notes ?? '')
  }, [open, consumable])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const value = intervalValue.trim() === '' ? null : Number(intervalValue)
    onSubmit({
      name: name.trim(),
      partNumber: partNumber.trim() || null,
      sizeOrSpec: sizeOrSpec.trim() || null,
      // The server rejects half an interval, so send both or neither.
      intervalValue: value,
      intervalUnit: value === null ? null : intervalUnit,
      lastReplacedOn: lastReplacedOn || null,
      quantityOnHand: Number(quantityOnHand) || 0,
      reorderUrl: reorderUrl.trim() || null,
      unitCost: unitCost.trim() === '' ? null : Number(unitCost),
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{consumable ? 'Edit consumable' : 'Add a consumable'}</DialogTitle>
            <DialogDescription>
              The size is the part that matters at the shop — record it exactly as it is printed.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="consumable-name">Name</Label>
              <Input
                id="consumable-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Air filter"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumable-size">Size or spec</Label>
              <Input
                id="consumable-size"
                value={sizeOrSpec}
                onChange={(e) => setSizeOrSpec(e.target.value)}
                placeholder="20x25x4 MERV 11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumable-part">Part number</Label>
              <Input
                id="consumable-part"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumable-interval">Replace every</Label>
              <div className="flex gap-2">
                <Input
                  id="consumable-interval"
                  type="number"
                  min="1"
                  className="w-24"
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(e.target.value)}
                />
                <Select
                  value={intervalUnit}
                  onValueChange={(v) => setIntervalUnit(v as RecurrenceUnit)}
                >
                  <SelectTrigger aria-label="Interval unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumable-last">Last changed</Label>
              <Input
                id="consumable-last"
                type="date"
                value={lastReplacedOn}
                onChange={(e) => setLastReplacedOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumable-qty">On hand</Label>
              <Input
                id="consumable-qty"
                type="number"
                min="0"
                value={quantityOnHand}
                onChange={(e) => setQuantityOnHand(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumable-cost">Unit cost</Label>
              <Input
                id="consumable-cost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="consumable-url">Reorder link</Label>
              <Input
                id="consumable-url"
                type="url"
                value={reorderUrl}
                onChange={(e) => setReorderUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="consumable-notes">Notes</Label>
              <Textarea
                id="consumable-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              {consumable ? 'Save changes' : 'Add consumable'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
