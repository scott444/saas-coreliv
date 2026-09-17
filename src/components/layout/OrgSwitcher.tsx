import { Building2, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrg } from '@/app/OrgProvider'

export function OrgSwitcher() {
  const { organizations, currentOrg, isLoading, setCurrentOrgId } = useOrg()

  if (isLoading) return <Skeleton className="h-8 w-40" />
  if (!currentOrg) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2 font-medium" aria-label="Switch organization">
          <Building2 className="text-muted-foreground" />
          <span className="max-w-[10rem] truncate">{currentOrg.name}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentOrg.id} onValueChange={setCurrentOrgId}>
          {organizations.map((org) => (
            <DropdownMenuRadioItem key={org.id} value={org.id}>
              <span className="truncate">{org.name}</span>
              <span className="ml-auto pl-2 text-xs text-muted-foreground">{org.memberCount} members</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
