import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { IrrigationZone, IrrigationZoneInput } from '@/domain'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/states'
import { errorMessage } from '@/lib/errorMessage'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

interface ZonePanelProps {
  zones: IrrigationZone[]
  canEdit: boolean
  onSave(input: IrrigationZoneInput): void
  onDelete(zoneId: string): void
  pending?: boolean
  error?: unknown
}

/**
 * Zones are a real relational subtype rather than a JSON blob on the
 * controller: each one has its own heads, valve location and schedule, and
 * you want to search them.
 */
export function ZonePanel({ zones, canEdit, onSave, onDelete, pending, error }: ZonePanelProps) {
  const [editing, setEditing] = useState<IrrigationZone | null>(null)
  const [open, setOpen] = useState(false)

  const nextNumber = zones.reduce((max, zone) => Math.max(max, zone.zoneNumber), 0) + 1

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Zones</CardTitle>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus /> Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {zones.length === 0 ? (
          <EmptyState
            title="No zones recorded"
            description="Which head type is on which valve, and how long each one runs."
          />
        ) : (
          <ul className="divide-y">
            {zones.map((zone) => (
              <li key={zone.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium tabular-nums">
                  {zone.zoneNumber}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{zone.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      zone.headType,
                      zone.headCount !== null ? `${zone.headCount} heads` : null,
                      zone.runMinutes !== null ? `${zone.runMinutes} min` : null,
                      zone.valveLocation,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No detail recorded'}
                  </p>
                  {zone.schedule ? (
                    <p className="text-xs text-muted-foreground">
                      {zone.schedule.days.join(', ')} at {zone.schedule.start}
                    </p>
                  ) : null}
                  {zone.notes ? <p className="text-sm">{zone.notes}</p> : null}
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(zone)
                        setOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete zone ${zone.zoneNumber}`}
                      onClick={() => onDelete(zone.id)}
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

      <ZoneDialog
        open={open}
        onOpenChange={setOpen}
        zone={editing}
        defaultNumber={nextNumber}
        pending={pending}
        error={error}
        onSubmit={(input) => {
          onSave(input)
          setOpen(false)
        }}
      />
    </Card>
  )
}

function ZoneDialog({
  open,
  onOpenChange,
  zone,
  defaultNumber,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  zone: IrrigationZone | null
  defaultNumber: number
  pending?: boolean
  error?: unknown
  onSubmit(input: IrrigationZoneInput): void
}) {
  const [zoneNumber, setZoneNumber] = useState('1')
  const [name, setName] = useState('')
  const [headType, setHeadType] = useState('')
  const [headCount, setHeadCount] = useState('')
  const [valveLocation, setValveLocation] = useState('')
  const [runMinutes, setRunMinutes] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [start, setStart] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setZoneNumber(String(zone?.zoneNumber ?? defaultNumber))
    setName(zone?.name ?? '')
    setHeadType(zone?.headType ?? '')
    setHeadCount(zone?.headCount === null || zone === null ? '' : String(zone.headCount))
    setValveLocation(zone?.valveLocation ?? '')
    setRunMinutes(zone?.runMinutes === null || zone === null ? '' : String(zone.runMinutes))
    setDays(zone?.schedule?.days ?? [])
    setStart(zone?.schedule?.start ?? '')
    setNotes(zone?.notes ?? '')
  }, [open, zone, defaultNumber])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      zoneNumber: Number(zoneNumber),
      name: name.trim(),
      headType: headType.trim() || null,
      headCount: headCount.trim() === '' ? null : Number(headCount),
      valveLocation: valveLocation.trim() || null,
      runMinutes: runMinutes.trim() === '' ? null : Number(runMinutes),
      schedule: days.length > 0 && start ? { days, start } : null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{zone ? `Edit zone ${zone.zoneNumber}` : 'Add a zone'}</DialogTitle>
            <DialogDescription>
              Saving a number that already exists edits that zone — the number is its identity on
              the controller.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save the zone')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="zone-number">Zone number</Label>
              <Input
                id="zone-number"
                type="number"
                min="1"
                value={zoneNumber}
                onChange={(e) => setZoneNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-name">Name</Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Front lawn"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-head">Head type</Label>
              <Input
                id="zone-head"
                value={headType}
                onChange={(e) => setHeadType(e.target.value)}
                placeholder="rotor, spray, drip, bubbler"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-count">Head count</Label>
              <Input
                id="zone-count"
                type="number"
                min="0"
                value={headCount}
                onChange={(e) => setHeadCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-valve">Valve location</Label>
              <Input
                id="zone-valve"
                value={valveLocation}
                onChange={(e) => setValveLocation(e.target.value)}
                placeholder="Box by the mailbox"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-minutes">Run time (min)</Label>
              <Input
                id="zone-minutes"
                type="number"
                min="0"
                value={runMinutes}
                onChange={(e) => setRunMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-start">Start time</Label>
              <Input
                id="zone-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-1">
                {DAYS.map((day) => {
                  const active = days.includes(day)
                  return (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() =>
                        setDays((current) =>
                          active ? current.filter((d) => d !== day) : [...current, day],
                        )
                      }
                    >
                      {day}
                    </Button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="zone-notes">Notes</Label>
              <Textarea
                id="zone-notes"
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
              Save zone
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
