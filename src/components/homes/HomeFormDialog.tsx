import { useEffect, useState, type FormEvent } from 'react'
import type { Home, HomeInput } from '@/domain'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface HomeFormDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  /** When provided the dialog edits this home; otherwise it creates one. */
  home?: Home | null
  pending?: boolean
  error?: unknown
  onSubmit(input: HomeInput): void
}

export function HomeFormDialog({ open, onOpenChange, home, pending, error, onSubmit }: HomeFormDialogProps) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    if (open) {
      setName(home?.name ?? '')
      setAddress(home?.address ?? '')
    }
  }, [open, home])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ name: name.trim(), address: address.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{home ? 'Edit home' : 'Add a home'}</DialogTitle>
            <DialogDescription>{home ? 'Update the name or address of this home.' : 'Give the home a name and, optionally, an address.'}</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error instanceof Error ? error.message : 'Could not save home'}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="home-name">Name</Label>
            <Input id="home-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lake House" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="home-address">Address</Label>
            <Input id="home-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="14 Strandvägen, Sigtuna" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              {home ? 'Save changes' : 'Add home'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
