import { Trash2 } from 'lucide-react'
import { ROLES, type Member, type Role, type User } from '@/domain'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, initials } from '@/lib/format'

interface MembersTableProps {
  members: Member[]
  currentUser: User
  onChangeRole(userId: string, role: Role): void
  onRemove(member: Member): void
  busyUserId?: string | null
}

export function MembersTable({ members, currentUser, onChangeRole, onRemove, busyUserId }: MembersTableProps) {
  const canManage = currentUser.role === 'Owner' || currentUser.role === 'Admin'

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead className="hidden sm:table-cell">Joined</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const isSelf = member.id === currentUser.id
          const isOwner = member.role === 'Owner'
          const editable = canManage && !isOwner && !isSelf
          return (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.name}
                      {isSelf ? <span className="ml-1 text-xs text-muted-foreground">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {member.status === 'Invited' ? <Badge variant="warning">Invited</Badge> : null}
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(member.joinedAt)}</TableCell>
              <TableCell>
                {editable ? (
                  <Select value={member.role} disabled={busyUserId === member.id} onValueChange={(v) => onChangeRole(member.id, v as Role)}>
                    <SelectTrigger className="h-8 w-32" aria-label={`Role for ${member.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => r !== 'Owner').map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={isOwner ? 'default' : 'secondary'}>{member.role}</Badge>
                )}
              </TableCell>
              <TableCell>
                {editable ? (
                  <Button variant="ghost" size="icon" aria-label={`Remove ${member.name}`} disabled={busyUserId === member.id} onClick={() => onRemove(member)}>
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
