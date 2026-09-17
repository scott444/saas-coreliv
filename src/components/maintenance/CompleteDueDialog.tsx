import { useEffect, useState, type FormEvent } from 'react'
import type { CompleteDueInput, DueItem, Vendor } from '@/domain'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { errorMessage } from '@/lib/errorMessage'

const NONE = '__none__'

export function CompleteDueDialog({
  item,
  vendors,
  open,
  onOpenChange,
  pending,
  error,
  onSubmit,
}: {
  item: DueItem | null
  vendors: Vendor[]
  open: boolean
  onOpenChange(open: boolean): void
  pending?: boolean
  error?: unknown
  onSubmit(input: CompleteDueInput): void
}) {
  const [occurredOn, setOccurredOn] = useState('')
  const [summary, setSummary] = useState('')
  const [vendorId, setVendorId] = useState(NONE)
  const [cost, setCost] = useState('')

  useEffect(() => {
    if (!open || !item) return
    setOccurredOn(new Date().toISOString().slice(0, 10))
    // Pre-filled so the common case is one click and Save; the log still gets
    // a real sentence rather than an empty row.
    setSummary(
      item.itemType === 'consumable'
        ? `Replaced the ${item.itemName.toLowerCase()}.`
        : `${item.itemName} done.`,
    )
    setVendorId(NONE)
    setCost('')
  }, [open, item])

  if (!item) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      occurredOn,
      summary: summary.trim(),
      vendorId: vendorId === NONE ? null : vendorId,
      cost: cost.trim() === '' ? null : Number(cost),
      notes: null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Mark done: {item.itemName}</DialogTitle>
            <DialogDescription>
              {item.assetId
                ? 'This advances the schedule and writes an entry in the service history.'
                : 'This advances the schedule. Property-level work has no asset to log against, so nothing is added to a service history.'}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="complete-date">When</Label>
              <Input
                id="complete-date"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-cost">Cost</Label>
              <Input
                id="complete-cost"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="complete-vendor">Who did it</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger id="complete-vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Did it myself</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="complete-summary">What happened</Label>
              <Textarea
                id="complete-summary"
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!summary.trim() || !occurredOn}>
              Mark done
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
