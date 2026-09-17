import { useEffect, useState, type FormEvent } from 'react'
import type { Vendor, VendorInput, VendorRole } from '@/domain'
import { VENDOR_ROLES, humanizeOption } from '@/domain'
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

export function VendorFormDialog({
  open,
  onOpenChange,
  vendor,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  vendor?: Vendor | null
  pending?: boolean
  error?: unknown
  onSubmit(input: VendorInput): void
}) {
  const [name, setName] = useState('')
  const [roles, setRoles] = useState<VendorRole[]>([])
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setName(vendor?.name ?? '')
    setRoles(vendor?.roles ?? [])
    setPhone(vendor?.phone ?? '')
    setEmail(vendor?.email ?? '')
    setWebsite(vendor?.website ?? '')
    setAccountNumber(vendor?.accountNumber ?? '')
    setNotes(vendor?.notes ?? '')
  }, [open, vendor])

  const toggleRole = (role: VendorRole) =>
    setRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      name: name.trim(),
      roles,
      phone: phone.trim() || null,
      email: email.trim() || null,
      website: website.trim() || null,
      accountNumber: accountNumber.trim() || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{vendor ? 'Edit vendor' : 'Add a vendor'}</DialogTitle>
            <DialogDescription>
              Who installed it, who services it, and the account number you have to quote when you
              call them.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save the vendor')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Comfort Systems HVAC"
            />
          </div>

          <div className="space-y-2">
            <Label>What they do</Label>
            <div className="flex flex-wrap gap-1">
              {VENDOR_ROLES.map((role) => (
                <Button
                  key={role}
                  type="button"
                  size="sm"
                  variant={roles.includes(role) ? 'default' : 'outline'}
                  aria-pressed={roles.includes(role)}
                  onClick={() => toggleRole(role)}
                >
                  {humanizeOption(role)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input id="vendor-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-website">Website</Label>
              <Input
                id="vendor-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-account">Your account number</Label>
              <Input
                id="vendor-account"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea
              id="vendor-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ask for Marco. Twice-yearly plan is prepaid through next spring."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              {vendor ? 'Save changes' : 'Add vendor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
