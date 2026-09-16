import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { SystemHardware, SystemHardwareInput } from '@/domain'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { errorMessage } from '@/lib/errorMessage'

interface HardwareFormDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  /** The record being edited, or null to enter one for the first time. */
  hardware?: SystemHardware | null
  pending?: boolean
  error?: unknown
  onSubmit(input: SystemHardwareInput): void
}

/** Every field is a string in the form; empty ones become null on submit. */
const EMPTY = {
  manufacturer: '',
  model: '',
  serialNumber: '',
  installedAt: '',
  warrantyExpiresAt: '',
  firmwareVersion: '',
  installer: '',
  notes: '',
}

type FormState = typeof EMPTY

function toFormState(hardware: SystemHardware | null | undefined): FormState {
  if (!hardware) return EMPTY
  return {
    manufacturer: hardware.manufacturer,
    model: hardware.model,
    serialNumber: hardware.serialNumber,
    installedAt: hardware.installedAt ?? '',
    warrantyExpiresAt: hardware.warrantyExpiresAt ?? '',
    firmwareVersion: hardware.firmwareVersion ?? '',
    installer: hardware.installer ?? '',
    notes: hardware.notes ?? '',
  }
}

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim())

export function HardwareFormDialog({ open, onOpenChange, hardware, pending, error, onSubmit }: HardwareFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY)

  useEffect(() => {
    if (open) setForm(toFormState(hardware))
  }, [open, hardware])

  const set = <K extends keyof FormState>(key: K, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const required = form.manufacturer.trim() !== '' && form.model.trim() !== ''
  // Mirrors the server rule, so the common mistake is caught before a round trip.
  const warrantyBeforeInstall =
    form.installedAt !== '' && form.warrantyExpiresAt !== '' && form.warrantyExpiresAt < form.installedAt

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!required || warrantyBeforeInstall) return
    onSubmit({
      manufacturer: form.manufacturer.trim(),
      model: form.model.trim(),
      serialNumber: form.serialNumber.trim(),
      installedAt: blankToNull(form.installedAt),
      warrantyExpiresAt: blankToNull(form.warrantyExpiresAt),
      firmwareVersion: blankToNull(form.firmwareVersion),
      installer: blankToNull(form.installer),
      notes: blankToNull(form.notes),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{hardware ? 'Edit hardware details' : 'Add hardware details'}</DialogTitle>
            <DialogDescription>
              Recorded against this system in Coreliv. Changing it here does not reconfigure the device.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save hardware details')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="hw-manufacturer" label="Manufacturer" required>
              <Input
                id="hw-manufacturer"
                value={form.manufacturer}
                onChange={(e) => set('manufacturer', e.target.value)}
                placeholder="Nibe"
                required
                autoFocus
              />
            </Field>
            <Field id="hw-model" label="Model" required>
              <Input id="hw-model" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="F1255-12 R" required />
            </Field>
          </div>

          <Field id="hw-serial" label="Serial number" hint="Leave blank if the device does not show one.">
            <Input
              id="hw-serial"
              value={form.serialNumber}
              onChange={(e) => set('serialNumber', e.target.value)}
              placeholder="NB-06621-448713"
              className="font-mono"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="hw-installed" label="Install date">
              <Input id="hw-installed" type="date" value={form.installedAt} onChange={(e) => set('installedAt', e.target.value)} />
            </Field>
            <Field id="hw-warranty" label="Warranty ends">
              <Input
                id="hw-warranty"
                type="date"
                value={form.warrantyExpiresAt}
                onChange={(e) => set('warrantyExpiresAt', e.target.value)}
                aria-invalid={warrantyBeforeInstall || undefined}
              />
            </Field>
          </div>
          {warrantyBeforeInstall ? (
            <p role="alert" className="text-sm text-destructive">
              Warranty cannot end before the install date.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="hw-firmware" label="Firmware version">
              <Input id="hw-firmware" value={form.firmwareVersion} onChange={(e) => set('firmwareVersion', e.target.value)} placeholder="9412R6" />
            </Field>
            <Field id="hw-installer" label="Installed by">
              <Input id="hw-installer" value={form.installer} onChange={(e) => set('installer', e.target.value)} placeholder="Sigtuna VVS & Värme AB" />
            </Field>
          </div>

          <Field id="hw-notes" label="Notes">
            <Textarea
              id="hw-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Service history, where the filter lives, anything the next person needs."
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!required || warrantyBeforeInstall}>
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
