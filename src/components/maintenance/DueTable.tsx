import { Link } from 'react-router-dom'
import { Check, Package, Wrench } from 'lucide-react'
import type { DueItem } from '@/domain'
import { describeInterval } from '@/domain'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateOnly } from '@/lib/format'
import { DueBadge } from '@/components/assets/StatusBadges'

interface DueTableProps {
  items: DueItem[]
  showProperty: boolean
  canEdit: boolean
  onComplete(item: DueItem): void
}

export function DueTable({ items, showProperty, canEdit, onComplete }: DueTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="hidden md:table-cell">Asset</TableHead>
            <TableHead className="hidden lg:table-cell">Every</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.itemType}-${item.id}`}>
              <TableCell>
                <div className="flex items-start gap-2">
                  {item.itemType === 'consumable' ? (
                    <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {showProperty ? `${item.propertyName} · ` : ''}
                      {item.diy ? 'DIY' : 'hire out'}
                      {item.lastDoneOn ? ` · last ${formatDateOnly(item.lastDoneOn)}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground md:hidden">
                      {item.assetName ?? 'Property-level'}
                    </p>
                  </div>
                </div>
              </TableCell>

              <TableCell className="hidden md:table-cell">
                {item.assetId && item.assetName ? (
                  <Link
                    to={`/assets/${item.assetId}`}
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    {item.assetName}
                  </Link>
                ) : (
                  // Gutters and septic pump-outs belong to the property, not
                  // to any one asset, and say so rather than showing a dash.
                  <Badge variant="outline">Property-level</Badge>
                )}
              </TableCell>

              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                {item.intervalValue && item.intervalUnit
                  ? describeInterval(item.intervalValue, item.intervalUnit)
                  : '—'}
              </TableCell>

              <TableCell className="whitespace-nowrap">
                <div className="flex flex-col items-start gap-1">
                  <DueBadge status={item.status} days={item.daysUntilDue} />
                  {item.dueOn ? (
                    <span className="text-xs text-muted-foreground">{formatDateOnly(item.dueOn)}</span>
                  ) : null}
                </div>
              </TableCell>

              <TableCell>
                {canEdit ? (
                  <Button size="sm" variant="outline" onClick={() => onComplete(item)}>
                    <Check /> Done
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
