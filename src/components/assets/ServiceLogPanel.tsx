import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ServiceEvent, ServiceEventInput, ServiceKind, Vendor } from '@/domain'
import { SERVICE_KINDS, SERVICE_KIND_LABELS, humanizeOption } from '@/domain'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

const NONE = '__none__'

const KIND_TONES: Record<ServiceKind, string> = {
  install: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  maintenance: 'border-border bg-muted text-muted-foreground',
  repair: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  inspection: 'border-border bg-muted text-muted-foreground',
  replacement: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  recall: 'border-destructive/30 bg-destructive/10 text-destructive',
  other: 'border-border bg-muted text-muted-foreground',
}

interface ServiceLogPanelProps {
  events: ServiceEvent[]
  vendors: Vendor[]
  canEdit: boolean
  onAdd(input: ServiceEventInput): void
  onDelete(eventId: string): void
  pending?: boolean
  error?: unknown
}

export function ServiceLogPanel({
  events,
  vendors,
  canEdit,
  onAdd,
  onDelete,
  pending,
  error,
}: ServiceLogPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Service history</CardTitle>
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus /> Log a visit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            description="Installs, services, repairs and inspections. Marking a maintenance item done writes an entry here automatically."
            action={canEdit ? <Button size="sm" onClick={() => setOpen(true)}>Log a visit</Button> : undefined}
          />
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {events.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[1.4rem] top-1.5 size-2 rounded-full bg-border ring-4 ring-background" />
                <div className="flex flex-wrap items-start gap-2">
                  <Badge variant="outline" className={KIND_TONES[event.kind]}>
                    {SERVICE_KIND_LABELS[event.kind]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDateOnly(event.occurredOn)}
                  </span>
                  {event.cost !== null && event.cost > 0 ? (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(event.cost)}
                    </span>
                  ) : null}
                  {canEdit ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto"
                      aria-label={`Delete service record from ${formatDateOnly(event.occurredOn)}`}
                      onClick={() => onDelete(event.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <p className="mt-1 text-sm">{event.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {[event.vendorName, event.technician].filter(Boolean).join(' · ') || 'No vendor recorded'}
                </p>
                {event.partsReplaced.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Parts: {event.partsReplaced.join(', ')}
                  </p>
                ) : null}
                {event.readings ? (
                  <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {Object.entries(event.readings).map(([key, value]) => (
                      <div key={key} className="flex gap-1">
                        <dt>{humanizeOption(key)}:</dt>
                        <dd className="tabular-nums">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <ServiceEventDialog
        open={open}
        onOpenChange={setOpen}
        vendors={vendors}
        pending={pending}
        error={error}
        onSubmit={(input) => {
          onAdd(input)
          setOpen(false)
        }}
      />
    </Card>
  )
}

function ServiceEventDialog({
  open,
  onOpenChange,
  vendors,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  vendors: Vendor[]
  pending?: boolean
  error?: unknown
  onSubmit(input: ServiceEventInput): void
}) {
  const [kind, setKind] = useState<ServiceKind>('maintenance')
  const [occurredOn, setOccurredOn] = useState('')
  const [vendorId, setVendorId] = useState(NONE)
  const [technician, setTechnician] = useState('')
  const [cost, setCost] = useState('')
  const [summary, setSummary] = useState('')
  const [parts, setParts] = useState('')

  useEffect(() => {
    if (!open) return
    setKind('maintenance')
    setOccurredOn(new Date().toISOString().slice(0, 10))
    setVendorId(NONE)
    setTechnician('')
    setCost('')
    setSummary('')
    setParts('')
  }, [open])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      taskId: null,
      consumableId: null,
      kind,
      occurredOn,
      vendorId: vendorId === NONE ? null : vendorId,
      technician: technician.trim() || null,
      cost: cost.trim() === '' ? null : Number(cost),
      coveredByWarrantyId: null,
      summary: summary.trim(),
      partsReplaced: parts
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
      readings: null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Log a visit</DialogTitle>
            <DialogDescription>
              The service log is append-only — it is the record you hand to a buyer or quote at a
              warranty desk.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save the record')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-kind">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ServiceKind)}>
                <SelectTrigger id="event-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SERVICE_KIND_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-date">When</Label>
              <Input
                id="event-date"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-vendor">Who did it</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger id="event-vendor">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set — did it myself</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-tech">Technician</Label>
              <Input
                id="event-tech"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-cost">Cost</Label>
              <Input
                id="event-cost"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-parts">Parts replaced</Label>
              <Input
                id="event-parts"
                value={parts}
                onChange={(e) => setParts(e.target.value)}
                placeholder="capacitor, contactor"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="event-summary">What happened</Label>
              <Textarea
                id="event-summary"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
                placeholder="Autumn service. Cleaned the burners and flame sensor, checked static pressure."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!summary.trim() || !occurredOn}>
              Save record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
