import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { DueItem, MaintenanceTask } from '@/domain'
import { describeInterval } from '@/domain'
import { useCurrentOrgId } from '@/app/OrgProvider'
import {
  useCompleteDueItem,
  useDeleteTask,
  useDueItems,
  useSaveTask,
  useTasks,
} from '@/hooks/useMaintenance'
import { useAssetRegister } from '@/hooks/useAssets'
import { useProperties } from '@/hooks/useProperties'
import { useVendors } from '@/hooks/useVendors'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DueTable } from '@/components/maintenance/DueTable'
import { CompleteDueDialog } from '@/components/maintenance/CompleteDueDialog'
import { TaskFormDialog } from '@/components/maintenance/TaskFormDialog'
import { formatDateOnly } from '@/lib/format'

export function MaintenancePage() {
  const orgId = useCurrentOrgId()
  const due = useDueItems(orgId)
  const tasks = useTasks(orgId)
  const properties = useProperties(orgId)
  const vendors = useVendors(orgId)
  const register = useAssetRegister(orgId)

  const complete = useCompleteDueItem(orgId)
  const saveTask = useSaveTask(orgId)
  const deleteTask = useDeleteTask(orgId)

  const [completing, setCompleting] = useState<DueItem | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null)
  const [newTaskPropertyId, setNewTaskPropertyId] = useState<string | null>(null)

  const items = useMemo(() => due.data ?? [], [due.data])
  const overdue = items.filter((item) => item.status === 'overdue' || item.status === 'due')
  const soon = items.filter((item) => item.status === 'soon')
  const never = items.filter((item) => item.status === 'unscheduled')

  const multipleProperties = (properties.data?.length ?? 0) > 1

  const openNewTask = () => {
    setEditingTask(null)
    setNewTaskPropertyId(properties.data?.[0]?.id ?? null)
    setTaskDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Filters and scheduled work, and everything that is behind."
        actions={
          (properties.data?.length ?? 0) > 0 ? (
            <Button onClick={openNewTask}>
              <Plus /> Add task
            </Button>
          ) : undefined
        }
      />

      {due.isPending ? (
        <LoadingState variant="page" />
      ) : due.error ? (
        <ErrorState error={due.error} title="Could not load what is due" onRetry={() => void due.refetch()} />
      ) : (
        <Tabs defaultValue="due">
          <TabsList>
            <TabsTrigger value="due">Due ({overdue.length + soon.length})</TabsTrigger>
            <TabsTrigger value="schedule">Everything ({items.length})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="due" className="space-y-6">
            {overdue.length === 0 && soon.length === 0 && never.length === 0 ? (
              <EmptyState
                title="Nothing needs doing"
                description="Everything with a schedule is inside its window."
              />
            ) : null}

            {overdue.length > 0 ? (
              <Section title="Overdue" tone="destructive" count={overdue.length}>
                <DueTable
                  items={overdue}
                  showProperty={multipleProperties}
                  canEdit
                  onComplete={setCompleting}
                />
              </Section>
            ) : null}

            {soon.length > 0 ? (
              <Section title="Coming up" tone="warning" count={soon.length}>
                <DueTable items={soon} showProperty={multipleProperties} canEdit onComplete={setCompleting} />
              </Section>
            ) : null}

            {never.length > 0 ? (
              <Section title="Never done" tone="info" count={never.length}>
                {/* Deliberately its own section rather than mixed into
                    overdue: there is no date to be late against, and a new
                    filter is not a failure. */}
                <DueTable items={never} showProperty={multipleProperties} canEdit onComplete={setCompleting} />
              </Section>
            ) : null}
          </TabsContent>

          <TabsContent value="schedule">
            {items.length === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                description="Add a task, or give a consumable a replacement interval."
              />
            ) : (
              <DueTable items={items} showProperty={multipleProperties} canEdit onComplete={setCompleting} />
            )}
          </TabsContent>

          <TabsContent value="tasks">
            {tasks.isPending ? (
              <LoadingState variant="list" />
            ) : (tasks.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No tasks yet"
                description="Recurring work: flushing the water heater, clearing the gutters, the irrigation blowout."
                action={<Button onClick={openNewTask}>Add a task</Button>}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <ul className="divide-y">
                    {(tasks.data ?? []).map((task) => (
                      <li key={task.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{task.name}</span>
                            {task.active ? null : <Badge variant="outline">Paused</Badge>}
                            <Badge variant="outline">{task.diy ? 'DIY' : 'Hire out'}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {describeInterval(task.intervalValue, task.intervalUnit)}
                            {task.seasonMonth ? ` · pinned to month ${task.seasonMonth}` : ''}
                            {' · '}
                            {task.assetName ?? `${task.propertyName} (whole property)`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {task.lastDoneOn
                              ? `last done ${formatDateOnly(task.lastDoneOn)}`
                              : 'never done'}
                            {task.preferredVendorName ? ` · ${task.preferredVendorName}` : ''}
                          </p>
                          {task.instructions ? (
                            <p className="text-sm">{task.instructions}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingTask(task)
                              setTaskDialogOpen(true)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${task.name}`}
                            onClick={() => deleteTask.mutate(task.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <CompleteDueDialog
        item={completing}
        vendors={vendors.data ?? []}
        open={completing !== null}
        onOpenChange={(open) => !open && setCompleting(null)}
        pending={complete.isPending}
        error={complete.error}
        onSubmit={(input) => {
          if (!completing) return
          complete.mutate(
            { itemType: completing.itemType, itemId: completing.id, input },
            { onSuccess: () => setCompleting(null) },
          )
        }}
      />

      <TaskFormDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        properties={properties.data ?? []}
        assets={register.data ?? []}
        vendors={vendors.data ?? []}
        propertyId={editingTask?.propertyId ?? newTaskPropertyId}
        onPropertyChange={setNewTaskPropertyId}
        pending={saveTask.isPending}
        error={saveTask.error}
        onSubmit={(input) => {
          const propertyId = editingTask?.propertyId ?? newTaskPropertyId
          if (!propertyId) return
          saveTask.mutate(
            { taskId: editingTask?.id, propertyId, input },
            { onSuccess: () => setTaskDialogOpen(false) },
          )
        }}
      />
    </div>
  )
}

const TONES = {
  destructive: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
} as const

function Section({
  title,
  tone,
  count,
  children,
}: {
  title: string
  tone: keyof typeof TONES
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <CardHeader className="flex-row items-center gap-2 space-y-0 p-0">
        <CardTitle className={TONES[tone]}>{title}</CardTitle>
        <span className="text-sm text-muted-foreground">({count})</span>
      </CardHeader>
      {children}
    </section>
  )
}
