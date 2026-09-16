import { Link } from 'react-router-dom'
import type { HardwareRegisterEntry } from '@/domain'
import { monthsInService, warrantySummary, type WarrantyState } from '@/domain'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SystemTypeIcon } from '@/components/systems/SystemMeta'
import { formatDateOnly, formatMonthSpan } from '@/lib/format'

const WARRANTY_BADGE: Record<WarrantyState, { variant: 'success' | 'warning' | 'muted' | 'outline'; label: string }> = {
  active: { variant: 'success', label: 'In warranty' },
  expiring: { variant: 'warning', label: 'Expiring soon' },
  expired: { variant: 'muted', label: 'Expired' },
  // A documented device whose warranty date nobody filled in. Distinct from a
  // system with no record at all, which shows an em-dash like its other cells.
  unknown: { variant: 'outline', label: 'No end date' },
}

export function HardwareRegisterTable({ entries }: { entries: HardwareRegisterEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Device</TableHead>
          <TableHead className="hidden md:table-cell">Home</TableHead>
          <TableHead>Hardware</TableHead>
          <TableHead className="hidden lg:table-cell">Serial</TableHead>
          <TableHead className="hidden lg:table-cell">Installed</TableHead>
          <TableHead>Warranty</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <RegisterRow key={entry.system.id} entry={entry} />
        ))}
      </TableBody>
    </Table>
  )
}

function RegisterRow({ entry }: { entry: HardwareRegisterEntry }) {
  const { system, homeName, hardware } = entry
  const months = monthsInService(hardware)
  const { state } = warrantySummary(hardware)
  const badge = WARRANTY_BADGE[state]

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <SystemTypeIcon type={system.type} className="size-8 [&>svg]:size-4" />
          <div className="min-w-0">
            <Link to={`/systems/${system.id}`} className="font-medium hover:underline">
              {system.name}
            </Link>
            <p className="text-xs text-muted-foreground md:hidden">{homeName}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{homeName}</TableCell>
      <TableCell>
        {hardware ? (
          <div className="min-w-0">
            <p className="truncate font-medium">{hardware.manufacturer}</p>
            <p className="truncate text-xs text-muted-foreground">{hardware.model}</p>
          </div>
        ) : (
          <Link to={`/systems/${system.id}`} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Add details
          </Link>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {hardware?.serialNumber ? (
          <span className="font-mono text-xs">{hardware.serialNumber}</span>
        ) : (
          <Muted />
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {hardware?.installedAt ? (
          <div>
            <p>{formatDateOnly(hardware.installedAt)}</p>
            {months !== null ? <p className="text-xs text-muted-foreground">{formatMonthSpan(months)}</p> : null}
          </div>
        ) : (
          <Muted />
        )}
      </TableCell>
      <TableCell>
        {hardware ? (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {hardware.warrantyExpiresAt ? (
              <span className="text-xs text-muted-foreground">{formatDateOnly(hardware.warrantyExpiresAt)}</span>
            ) : null}
          </div>
        ) : (
          <Muted />
        )}
      </TableCell>
    </TableRow>
  )
}

function Muted() {
  return <span className="text-sm text-muted-foreground">—</span>
}
