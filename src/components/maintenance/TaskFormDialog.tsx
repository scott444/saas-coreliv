import { useEffect, useState, type FormEvent } from 'react'
import type {
  AssetListEntry,
  MaintenanceTask,
  MaintenanceTaskInput,
  Property,
  RecurrenceUnit,
  Vendor,
} from '@/domain'
import { RECURRENCE_UNITS } from '@/domain'
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
import { errorMessage } from '@/lib/errorMessage'

const NONE = '__none__'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  properties,
  assets,
  vendors,
  propertyId,
  onPropertyChange,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  task?: MaintenanceTask | null
  properties: Property[]
  assets: AssetListEntry[]
  vendors: Vendor[]
  propertyId: string | null
  onPropertyChange(propertyId: string): void
  pending?: boolean
  error?: unknown
  onSubmit(input: MaintenanceTaskInput): void
}) {
  const [name, setName] = useState('')
  const [assetId, setAssetId] = useState(NONE)
  const [intervalValue, setIntervalValue] = useState('1')
  const [intervalUnit, setIntervalUnit] = useState<RecurrenceUnit>('year')
  const [seasonMonth, setSeasonMonth] = useState(NONE)
  const [diy, setDiy] = useState(true)
  const [preferredVendorId, setPreferredVendorId] = useState(NONE)
  const [lastDoneOn, setLastDoneOn] = useState('')
  const [instructions, setInstructions] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(task?.name ?? '')
    setAssetId(task?.assetId ?? NONE)
    setIntervalValue(String(task?.intervalValue ?? 1))
    setIntervalUnit(task?.intervalUnit ?? 'year')
    setSeasonMonth(task?.seasonMonth ? String(task.seasonMonth) : NONE)
    setDiy(task?.diy ?? true)
    setPreferredVendorId(task?.preferredVendorId ?? NONE)
    setLastDoneOn(task?.lastDoneOn ?? '')
    setInstructions(task?.instructions ?? '')
    setActive(task?.active ?? true)
  }, [open, task])

  // A task filed under a property can only hang off an asset in that property.
  const eligibleAssets = assets.filter((asset) => asset.propertyId === (task?.propertyId ?? propertyId))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      assetId: assetId === NONE ? null : assetId,
      name: name.trim(),
      intervalValue: Number(intervalValue) || 1,
      intervalUnit,
      seasonMonth: seasonMonth === NONE ? null : Number(seasonMonth),
      diy,
      preferredVendorId: preferredVendorId === NONE ? null : preferredVendorId,
      lastDoneOn: lastDoneOn || null,
      instructions: instructions.trim() || null,
      active,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{task ? 'Edit task' : 'Add a maintenance task'}</DialogTitle>
            <DialogDescription>
              Leave the last-done date empty for something you have never done — it will show as
              "never done" rather than pretending to be overdue.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save the task')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="task-name">Name</Label>
              <Input
                id="task-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Flush water heater"
                required
                autoFocus
              />
            </div>

            {!task ? (
              <div className="space-y-2">
                <Label htmlFor="task-property">Property</Label>
                <Select value={propertyId ?? NONE} onValueChange={onPropertyChange}>
                  <SelectTrigger id="task-property">
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
              <Label htmlFor="task-asset">Asset</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger id="task-asset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Whole property</SelectItem>
                  {eligibleAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-interval">Repeat every</Label>
              <div className="flex gap-2">
                <Input
                  id="task-interval"
                  type="number"
                  min="1"
                  className="w-24"
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(e.target.value)}
                  required
                />
                <Select value={intervalUnit} onValueChange={(v) => setIntervalUnit(v as RecurrenceUnit)}>
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
              <Label htmlFor="task-season">Pin to a month</Label>
              <Select value={seasonMonth} onValueChange={setSeasonMonth}>
                <SelectTrigger id="task-season">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any time</SelectItem>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-last">Last done</Label>
              <Input
                id="task-last"
                type="date"
                value={lastDoneOn}
                onChange={(e) => setLastDoneOn(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-vendor">Preferred vendor</Label>
              <Select value={preferredVendorId} onValueChange={setPreferredVendorId}>
                <SelectTrigger id="task-vendor">
                  <SelectValue />
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

            <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={diy} onCheckedChange={setDiy} /> I do this myself
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={active} onCheckedChange={setActive} /> Active
              </label>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="task-instructions">Instructions</Label>
              <Textarea
                id="task-instructions"
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Hose to the floor drain, open the drain valve, run until clear."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim() || (!task && !propertyId)}>
              {task ? 'Save changes' : 'Add task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
