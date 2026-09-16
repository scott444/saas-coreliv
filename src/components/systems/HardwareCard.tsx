import { useState, type ReactNode } from 'react'
import { Cpu, Pencil, Plus } from 'lucide-react'
import type { SystemHardware } from '@/domain'
import { monthsInService, warrantySummary, type WarrantyState } from '@/domain'
import { useSaveSystemHardware, useSystemHardware } from '@/hooks/useSystems'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { HardwareFormDialog } from '@/components/systems/HardwareFormDialog'
import { formatDateOnly, formatMonthSpan } from '@/lib/format'

/**
 * The asset record for the physical device: what it is, when it went in, and
 * the identifiers you would have to read off the casing otherwise.
 */
export function HardwareCard({ systemId }: { systemId: string }) {
  const hardware = useSystemHardware(systemId)
  const save = useSaveSystemHardware(systemId)
  const { toast } = useToast()
  const [formOpen, setFormOpen] = useState(false)

  const record = hardware.data ?? null
  const openForm = () => {
    save.reset()
    setFormOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Hardware</CardTitle>
          <CardDescription>Details of the installed device, for service and warranty claims.</CardDescription>
        </div>
        {record ? (
          <Button variant="ghost" size="sm" onClick={openForm}>
            <Pencil /> Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {hardware.isPending ? (
          <LoadingState variant="list" count={4} />
        ) : hardware.isError ? (
          <ErrorState error={hardware.error} onRetry={() => void hardware.refetch()} compact />
        ) : record ? (
          <HardwareSpecs hardware={record} />
        ) : (
          <EmptyState
            icon={<Cpu className="size-6" />}
            title="No hardware recorded"
            description="Add the manufacturer, model and serial number so they are to hand when something needs servicing."
            action={
              <Button onClick={openForm}>
                <Plus /> Add hardware details
              </Button>
            }
            className="p-6"
          />
        )}
      </CardContent>

      <HardwareFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        hardware={record}
        pending={save.isPending}
        error={save.error}
        onSubmit={(input) =>
          save.mutate(input, {
            onSuccess: () => {
              setFormOpen(false)
              toast({ title: 'Hardware details saved', variant: 'success' })
            },
          })
        }
      />
    </Card>
  )
}

function HardwareSpecs({ hardware }: { hardware: SystemHardware }) {
  const months = monthsInService(hardware)

  return (
    <dl className="divide-y text-sm">
      <Spec label="Manufacturer" value={hardware.manufacturer} />
      <Spec label="Model" value={hardware.model} />
      <Spec
        label="Serial number"
        value={hardware.serialNumber ? <span className="font-mono text-xs">{hardware.serialNumber}</span> : null}
      />
      <Spec
        label="Installed"
        value={
          hardware.installedAt ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              {formatDateOnly(hardware.installedAt)}
              {months !== null ? <span className="text-xs text-muted-foreground">{formatMonthSpan(months)} in service</span> : null}
            </span>
          ) : null
        }
      />
      <Spec label="Warranty" value={<WarrantyValue hardware={hardware} />} />
      <Spec label="Firmware" value={hardware.firmwareVersion} />
      <Spec label="Installed by" value={hardware.installer} />
      {hardware.notes ? <Spec label="Notes" value={<span className="whitespace-pre-wrap">{hardware.notes}</span>} /> : null}
    </dl>
  )
}

function Spec({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 min-w-0 break-words sm:col-span-1">
        {value ?? <span className="text-muted-foreground">Not recorded</span>}
      </dd>
    </div>
  )
}

const WARRANTY_BADGE: Record<Exclude<WarrantyState, 'unknown'>, { variant: 'success' | 'warning' | 'muted'; label: string }> = {
  active: { variant: 'success', label: 'In warranty' },
  expiring: { variant: 'warning', label: 'Expiring soon' },
  expired: { variant: 'muted', label: 'Expired' },
}

function WarrantyValue({ hardware }: { hardware: SystemHardware }) {
  const { state, daysRemaining } = warrantySummary(hardware)
  if (state === 'unknown' || !hardware.warrantyExpiresAt) return null

  const badge = WARRANTY_BADGE[state]
  return (
    <span className="flex flex-wrap items-center gap-2">
      {formatDateOnly(hardware.warrantyExpiresAt)}
      <Badge variant={badge.variant}>{badge.label}</Badge>
      {state === 'expiring' && daysRemaining !== null ? (
        <span className="text-xs text-muted-foreground">
          {daysRemaining === 0 ? 'ends today' : `${daysRemaining} days left`}
        </span>
      ) : null}
    </span>
  )
}
