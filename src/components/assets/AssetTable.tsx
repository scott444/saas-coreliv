import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronsUpDown, FileText, Paperclip } from 'lucide-react'
import type { AssetListEntry } from '@/domain'
import { formatServiceAge, monthsInService } from '@/domain'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AssetStatusBadge, WarrantyBadge } from './StatusBadges'
import type { SortKey } from './registerFilter'

interface AssetTableProps {
  entries: AssetListEntry[]
  sortKey: SortKey
  sortDirection: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  /** Shown above the property column when the register spans more than one. */
  showProperty: boolean
}

function SortButton({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
  className,
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  sortDirection: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = sortKey === column
  const Icon = !active ? ChevronsUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded transition-colors hover:text-foreground',
        active ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      {label}
      <Icon className="size-3" />
    </button>
  )
}

export function AssetTable({
  entries,
  sortKey,
  sortDirection,
  onSort,
  showProperty,
}: AssetTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton label="Asset" column="name" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead className="hidden md:table-cell">
              <SortButton label="Category" column="category" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead className="hidden lg:table-cell">
              {showProperty ? (
                <SortButton label="Where" column="property" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
              ) : (
                'Where'
              )}
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              <SortButton label="In service" column="age" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortButton label="Warranty" column="warranty" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead className="hidden xl:table-cell">
              <SortButton label="Last service" column="serviced" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="group">
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/assets/${entry.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {entry.name}
                    </Link>
                    <AssetStatusBadge status={entry.status} />
                    {entry.openItemCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/30 bg-destructive/10 font-medium text-destructive"
                      >
                        {entry.openItemCount} overdue
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[entry.brand, entry.modelNumber].filter(Boolean).join(' ') || 'No make or model recorded'}
                    {entry.serialNumber ? ` · ${entry.serialNumber}` : ''}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground md:hidden">
                    <span>{entry.categoryName ?? 'Uncategorised'}</span>
                    {showProperty ? <span>· {entry.propertyName}</span> : null}
                  </div>
                </div>
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <span className="text-sm">{entry.categoryName ?? '—'}</span>
                {entry.groupName ? (
                  <p className="text-xs text-muted-foreground">{entry.groupName}</p>
                ) : null}
              </TableCell>

              <TableCell className="hidden lg:table-cell">
                <span className="text-sm">{entry.locationName ?? '—'}</span>
                {showProperty ? (
                  <p className="text-xs text-muted-foreground">{entry.propertyName}</p>
                ) : null}
              </TableCell>

              <TableCell className="hidden whitespace-nowrap sm:table-cell">
                <span className="text-sm tabular-nums">
                  {formatServiceAge(monthsInService(entry.installDate))}
                </span>
                {entry.installDate ? (
                  <p className="text-xs text-muted-foreground">
                    since {formatDateOnly(entry.installDate)}
                  </p>
                ) : null}
              </TableCell>

              <TableCell>
                <WarrantyBadge summary={entry.warranty} />
              </TableCell>

              <TableCell className="hidden whitespace-nowrap xl:table-cell">
                {entry.lastServicedOn ? (
                  <span className="text-sm">{formatDateOnly(entry.lastServicedOn)}</span>
                ) : (
                  // An em-dash for "never serviced" and a real count for
                  // documents: the two absences are different facts.
                  <span className="text-sm text-muted-foreground">—</span>
                )}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {entry.documentCount > 0 ? (
                    <>
                      <Paperclip className="size-3" />
                      {entry.documentCount}
                    </>
                  ) : (
                    <>
                      <FileText className="size-3 opacity-50" />
                      no documents
                    </>
                  )}
                </p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
