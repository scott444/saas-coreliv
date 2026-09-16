import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Home as HomeIcon, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Home } from '@/domain'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { useCreateHome, useDeleteHome, useHomes, useUpdateHome } from '@/hooks/useHomes'
import { useSystems } from '@/hooks/useSystems'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { HomeFormDialog } from '@/components/homes/HomeFormDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { errorMessage } from '@/lib/errorMessage'

export function HomesPage() {
  const orgId = useCurrentOrgId()
  const homes = useHomes(orgId)
  const create = useCreateHome(orgId)
  const update = useUpdateHome(orgId)
  const remove = useDeleteHome(orgId)
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Home | null>(null)
  const [deleting, setDeleting] = useState<Home | null>(null)

  const openCreate = () => {
    setEditing(null)
    create.reset()
    setFormOpen(true)
  }
  const openEdit = (home: Home) => {
    setEditing(home)
    update.reset()
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homes"
        description="Each home groups the systems installed at one address."
        actions={
          <Button onClick={openCreate}>
            <Plus /> Add home
          </Button>
        }
      />

      {homes.isPending ? (
        <LoadingState variant="cards" count={2} />
      ) : homes.isError ? (
        <ErrorState error={homes.error} title="Could not load homes" onRetry={() => void homes.refetch()} />
      ) : homes.data.length === 0 ? (
        <EmptyState
          icon={<HomeIcon className="size-6" />}
          title="No homes yet"
          description="Add a home to start organizing your systems."
          action={
            <Button onClick={openCreate}>
              <Plus /> Add home
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {homes.data.map((home) => (
            <HomeCard key={home.id} home={home} onEdit={() => openEdit(home)} onDelete={() => setDeleting(home)} />
          ))}
        </div>
      )}

      <HomeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        home={editing}
        pending={create.isPending || update.isPending}
        error={editing ? update.error : create.error}
        onSubmit={(input) => {
          const done = () => {
            setFormOpen(false)
            toast({ title: editing ? 'Home updated' : 'Home added', variant: 'success' })
          }
          if (editing) update.mutate({ homeId: editing.id, input }, { onSuccess: done })
          else create.mutate(input, { onSuccess: done })
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleting?.name}?</DialogTitle>
            <DialogDescription>All systems in this home will be removed from Coreliv. Devices themselves are not affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={remove.isPending}
              onClick={() => {
                if (!deleting) return
                remove.mutate(deleting.id, {
                  onSuccess: () => {
                    setDeleting(null)
                    toast({ title: 'Home removed' })
                  },
                  onError: (err) => toast({ title: 'Could not remove home', description: errorMessage(err), variant: 'error' }),
                })
              }}
            >
              Remove home
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HomeCard({ home, onEdit, onDelete }: { home: Home; onEdit(): void; onDelete(): void }) {
  const systems = useSystems(home.id)
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HomeIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{home.name}</p>
          <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" /> {home.address || 'No address'}
          </p>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {systems.isPending ? 'Counting systems…' : systems.isError ? 'Systems unavailable' : `${systems.data.length} systems · ${systems.data.filter((s) => s.status === 'Online').length} online`}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">View on dashboard</Link>
        </Button>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={`Edit ${home.name}`} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Remove ${home.name}`} onClick={onDelete}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
