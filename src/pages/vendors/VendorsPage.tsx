import { useState } from 'react'
import { ExternalLink, Mail, Phone, Plus, Trash2 } from 'lucide-react'
import type { Vendor } from '@/domain'
import { humanizeOption } from '@/domain'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { useDeleteVendor, useSaveVendor, useVendors } from '@/hooks/useVendors'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorFormDialog } from '@/components/vendors/VendorFormDialog'

export function VendorsPage() {
  const orgId = useCurrentOrgId()
  const vendors = useVendors(orgId)
  const saveVendor = useSaveVendor(orgId)
  const deleteVendor = useDeleteVendor(orgId)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)

  const openNew = () => {
    setEditing(null)
    setOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Who installed it, who services it, and the account number you have to quote."
        actions={
          <Button onClick={openNew}>
            <Plus /> Add vendor
          </Button>
        }
      />

      {vendors.isPending ? (
        <LoadingState variant="cards" />
      ) : vendors.error ? (
        <ErrorState
          error={vendors.error}
          title="Could not load your vendors"
          onRetry={() => void vendors.refetch()}
        />
      ) : (vendors.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="The plumber you actually call back, the HVAC company holding your service plan, the shop the fridge came from."
          action={<Button onClick={openNew}>Add a vendor</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(vendors.data ?? []).map((vendor) => (
            <Card key={vendor.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="min-w-0 space-y-2">
                  <CardTitle>{vendor.name}</CardTitle>
                  <div className="flex flex-wrap gap-1">
                    {vendor.roles.map((role) => (
                      <Badge key={role} variant="outline">
                        {humanizeOption(role)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  {vendor.phone ? (
                    <a
                      href={`tel:${vendor.phone}`}
                      className="flex items-center gap-2 underline-offset-4 hover:underline"
                    >
                      <Phone className="size-3.5 text-muted-foreground" />
                      {vendor.phone}
                    </a>
                  ) : null}
                  {vendor.email ? (
                    <a
                      href={`mailto:${vendor.email}`}
                      className="flex items-center gap-2 underline-offset-4 hover:underline"
                    >
                      <Mail className="size-3.5 text-muted-foreground" />
                      {vendor.email}
                    </a>
                  ) : null}
                  {vendor.website ? (
                    <a
                      href={vendor.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-2 underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                      Website
                    </a>
                  ) : null}
                  {vendor.accountNumber ? (
                    <p className="text-muted-foreground">Account {vendor.accountNumber}</p>
                  ) : null}
                </div>

                {vendor.notes ? <p className="text-sm">{vendor.notes}</p> : null}

                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  {/* Their references go null on delete rather than cascading,
                      so the count is what the user is really deciding about. */}
                  <span className="text-xs text-muted-foreground">
                    {vendor.useCount === 0
                      ? 'Not referenced yet'
                      : `Referenced ${vendor.useCount} ${vendor.useCount === 1 ? 'time' : 'times'}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(vendor)
                        setOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${vendor.name}`}
                      onClick={() => deleteVendor.mutate(vendor.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VendorFormDialog
        open={open}
        onOpenChange={setOpen}
        vendor={editing}
        pending={saveVendor.isPending}
        error={saveVendor.error}
        onSubmit={(input) =>
          saveVendor.mutate({ vendorId: editing?.id, input }, { onSuccess: () => setOpen(false) })
        }
      />
    </div>
  )
}
