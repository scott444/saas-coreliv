import { Link } from 'react-router-dom'
import { ArrowRight, Minus, Plus, Power, Square, WifiOff } from 'lucide-react'
import type { HomeSystem, SystemCommand, SystemState } from '@/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSendCommand, useSystemState } from '@/hooks/useSystems'
import { useToast } from '@/components/ui/toast'
import { errorMessage } from '@/lib/errorMessage'
import { SystemStatusBadge, SystemTypeIcon } from './SystemMeta'
import { StateSummary } from './StateSummary'

interface SystemCardProps {
  system: HomeSystem
  commandsDisabled?: boolean
}

export function SystemCard({ system, commandsDisabled = false }: SystemCardProps) {
  const { toast } = useToast()
  const stateQuery = useSystemState(system.id, { enabled: system.status !== 'Offline' })
  const send = useSendCommand(system.id, {
    onError: (error) => toast({ title: `${system.name}: command failed`, description: error.message, variant: 'error' }),
  })

  const disabled = commandsDisabled || system.status !== 'Online' || send.isPending

  return (
    <Card className="flex flex-col" data-testid={`system-card-${system.id}`}>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <SystemTypeIcon type={system.type} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{system.name}</p>
          <p className="text-xs text-muted-foreground">{system.type}</p>
        </div>
        <SystemStatusBadge status={system.status} />
      </CardHeader>

      <CardContent className="flex-1">
        {system.status === 'Offline' ? (
          <Unavailable icon={<WifiOff className="size-4" />} text="Device is offline. Live state unavailable." />
        ) : stateQuery.isPending ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : stateQuery.isError ? (
          <Unavailable icon={<WifiOff className="size-4" />} text={errorMessage(stateQuery.error)} />
        ) : (
          <StateSummary state={stateQuery.data} />
        )}
      </CardContent>

      <CardFooter className="justify-between gap-2">
        <div className="flex items-center gap-1">
          {stateQuery.data ? <QuickActions state={stateQuery.data} disabled={disabled} onCommand={(c) => send.mutate(c)} /> : null}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/systems/${system.id}`}>
            Details <ArrowRight />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function Unavailable({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
      {icon}
      <span>{text}</span>
    </div>
  )
}

function QuickActions({ state, disabled, onCommand }: { state: SystemState; disabled: boolean; onCommand(c: SystemCommand): void }) {
  switch (state.type) {
    case 'Heating':
    case 'Cooling': {
      const type = state.type
      const off = state.mode === 'Off'
      return (
        <>
          <Button variant="outline" size="icon" className="size-8" aria-label="Lower target" disabled={disabled || off} onClick={() => onCommand({ type, action: 'setTargetTemp', targetTemp: state.targetTemp - 0.5 })}>
            <Minus />
          </Button>
          <Button variant="outline" size="icon" className="size-8" aria-label="Raise target" disabled={disabled || off} onClick={() => onCommand({ type, action: 'setTargetTemp', targetTemp: state.targetTemp + 0.5 })}>
            <Plus />
          </Button>
        </>
      )
    }
    case 'Irrigation': {
      const anyRunning = state.zones.some((z) => z.isRunning)
      return (
        <Button variant="outline" size="sm" disabled={disabled || !anyRunning} onClick={() => onCommand({ type: 'Irrigation', action: 'stopAll' })}>
          <Square /> Stop all
        </Button>
      )
    }
    case 'Appliance': {
      const isOn = state.powerState !== 'Off'
      return (
        <Button variant="outline" size="sm" disabled={disabled} aria-pressed={isOn} onClick={() => onCommand({ type: 'Appliance', action: 'setPower', powerState: isOn ? 'Off' : 'On' })}>
          <Power /> {isOn ? 'Turn off' : 'Turn on'}
        </Button>
      )
    }
  }
}
