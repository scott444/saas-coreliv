import { useEffect, useState, type FormEvent } from 'react'
import { ROLES, type Role } from '@/domain'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  pending?: boolean
  error?: unknown
  onSubmit(input: { email: string; role: Role }): void
}

const INVITABLE_ROLES = ROLES.filter((r) => r !== 'Owner')

export function InviteMemberDialog({ open, onOpenChange, pending, error, onSubmit }: InviteMemberDialogProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('Member')

  useEffect(() => {
    if (open) {
      setEmail('')
      setRole('Member')
    }
  }, [open])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ email: email.trim(), role })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>They will receive an email with a link to join this organization.</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error instanceof Error ? error.message : 'Could not send invite'}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!email.trim()}>
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
