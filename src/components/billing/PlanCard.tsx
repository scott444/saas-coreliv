import { Check } from 'lucide-react'
import type { Plan } from '@/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PlanCardProps {
  plan: Plan
  isCurrent: boolean
  isUpgrade: boolean
  pending?: boolean
  disabled?: boolean
  onSelect(planId: string): void
}

export function PlanCard({ plan, isCurrent, isUpgrade, pending, disabled, onSelect }: PlanCardProps) {
  return (
    <Card className={cn('flex flex-col', isCurrent && 'border-primary ring-1 ring-primary')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.name}</CardTitle>
          {isCurrent ? <Badge>Current</Badge> : null}
        </div>
        <CardDescription>
          <span className="text-2xl font-semibold text-foreground">{plan.priceMonthly === 0 ? 'Free' : formatCurrency(plan.priceMonthly)}</span>
          {plan.priceMonthly > 0 ? <span className="text-muted-foreground"> / month</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={isCurrent ? 'outline' : isUpgrade ? 'default' : 'secondary'}
          disabled={isCurrent || disabled}
          loading={pending}
          onClick={() => onSelect(plan.id)}
        >
          {isCurrent ? 'Current plan' : isUpgrade ? 'Upgrade' : 'Switch'}
        </Button>
      </CardFooter>
    </Card>
  )
}
