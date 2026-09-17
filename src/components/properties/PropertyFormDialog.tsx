import { useEffect, useState, type FormEvent } from 'react'
import type { Property, PropertyInput } from '@/domain'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { errorMessage } from '@/lib/errorMessage'

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  property?: Property | null
  pending?: boolean
  error?: unknown
  onSubmit(input: PropertyInput): void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [yearBuilt, setYearBuilt] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setName(property?.name ?? '')
    setAddress(property?.address ?? '')
    setYearBuilt(property?.yearBuilt ? String(property.yearBuilt) : '')
    setPurchaseDate(property?.purchaseDate ?? '')
    setNotes(property?.notes ?? '')
  }, [open, property])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      name: name.trim(),
      address: address.trim() || null,
      yearBuilt: yearBuilt.trim() === '' ? null : Number(yearBuilt),
      purchaseDate: purchaseDate || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{property ? 'Edit property' : 'Add a property'}</DialogTitle>
            <DialogDescription>
              Every asset, task and document hangs off a property. Most accounts only ever need one.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save the property')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="property-name">Name</Label>
            <Input
              id="property-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maple Street"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-address">Address</Label>
            <Input
              id="property-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="property-year">Year built</Label>
              <Input
                id="property-year"
                type="number"
                min="1500"
                max={new Date().getFullYear() + 5}
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property-purchased">Purchased</Label>
              <Input
                id="property-purchased"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-notes">Notes</Label>
            <Textarea
              id="property-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Crawlspace under the east wing, attic access in the hall closet."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              {property ? 'Save changes' : 'Add property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
