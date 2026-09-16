import { useState } from 'react'
import { UserPlus, Users } from 'lucide-react'
import type { Member } from '@/domain'
import { useAuth } from '@/app/AuthProvider'
import { useOrg } from '@/app/OrgProvider'
import { useChangeRole, useInviteMember, useMembers, useRemoveMember } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { MembersTable } from '@/components/organization/MembersTable'
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog'
import { PageHeader } from '@/components/layout/PageHeader'

export function OrganizationPage() {
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const orgId = currentOrg?.id ?? ''
  const members = useMembers(orgId)
  const invite = useInviteMember(orgId)
  const changeRole = useChangeRole(orgId)
  const removeMember = useRemoveMember(orgId)
  const { toast } = useToast()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [removing, setRemoving] = useState<Member | null>(null)

  if (!currentOrg || !user) return null
  const canManage = user.role === 'Owner' || user.role === 'Admin'

  return (
    <div className="space-y-6">
      <PageHeader
        title={currentOrg.name}
        description="Manage who can see and control the homes in this organization."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                invite.reset()
                setInviteOpen(true)
              }}
            >
              <UserPlus /> Invite member
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Owners manage billing and members. Admins manage members and systems. Members can view and control systems.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {members.isPending ? (
            <div className="p-5">
              <LoadingState variant="list" count={3} />
            </div>
          ) : members.isError ? (
            <div className="p-5">
              <ErrorState error={members.error} title="Could not load members" onRetry={() => void members.refetch()} />
            </div>
          ) : members.data.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title="No members" className="m-5" />
          ) : (
            <MembersTable
              members={members.data}
              currentUser={user}
              busyUserId={changeRole.isPending ? changeRole.variables?.userId : removeMember.isPending ? removeMember.variables : null}
              onChangeRole={(userId, role) =>
                changeRole.mutate(
                  { userId, role },
                  {
                    onError: (err) => toast({ title: 'Could not change role', description: err.message, variant: 'error' }),
                  },
                )
              }
              onRemove={setRemoving}
            />
          )}
        </CardContent>
      </Card>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        pending={invite.isPending}
        error={invite.error}
        onSubmit={(input) =>
          invite.mutate(input, {
            onSuccess: (member) => {
              setInviteOpen(false)
              toast({ title: 'Invite sent', description: `${member.email} was invited as ${member.role}.`, variant: 'success' })
            },
          })
        }
      />

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>They will immediately lose access to every home in {currentOrg.name}.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={removeMember.isPending}
              onClick={() => {
                if (!removing) return
                removeMember.mutate(removing.id, {
                  onSuccess: () => {
                    setRemoving(null)
                    toast({ title: 'Member removed' })
                  },
                  onError: (err) => toast({ title: 'Could not remove member', description: err.message, variant: 'error' }),
                })
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
