import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { DueItem, MaintenanceTask } from '../../../src/domain/index.js'
import { daysFromToday, dueStatus } from '../../../src/domain/index.js'
import { query, queryOne, transaction } from '../db/pool.js'
import { assertWritable } from '../lib/limits.js'
import { invalid, notFound } from '../lib/errors.js'
import { TASK_SELECT } from './selects.js'
import {
  idParams,
  money,
  nullableDate,
  nullableText,
  orgParams,
  recurrenceUnit,
  requiredText,
  requireOrg,
  requireScope,
  uuid,
} from './helpers.js'

const taskInput = z.object({
  assetId: uuid.nullable().default(null),
  name: requiredText(160),
  intervalValue: z.number().int().min(1, 'Must be at least 1').max(32_767),
  intervalUnit: recurrenceUnit,
  seasonMonth: z.number().int().min(1).max(12).nullable().default(null),
  diy: z.boolean().default(true),
  preferredVendorId: uuid.nullable().default(null),
  lastDoneOn: nullableDate,
  instructions: nullableText,
  active: z.boolean().default(true),
})

const completeInput = z.object({
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date'),
  summary: requiredText(2000),
  vendorId: uuid.nullable().default(null),
  cost: money,
  notes: nullableText,
})

const completeParams = z.object({
  itemType: z.enum(['task', 'consumable']),
  id: uuid,
})

/**
 * Consumables and tasks, unioned.
 *
 * Both halves keep rows that have never been done, with a null `dueOn`. The
 * schema's `v_upcoming_due` view drops those - it requires a last-done date to
 * project from - but "you have never flushed the water heater" is exactly the
 * item the list exists to surface, so it is carried through as `unscheduled`
 * rather than filtered out.
 */
const DUE_SQL = `
  SELECT 'task' AS "itemType",
         t.id,
         t.property_id AS "propertyId",
         p.name        AS "propertyName",
         t.asset_id    AS "assetId",
         a.name        AS "assetName",
         t.name        AS "itemName",
         CASE WHEN t.last_done_on IS NULL THEN NULL
              ELSE add_interval(t.last_done_on, t.interval_value, t.interval_unit) END AS "dueOn",
         t.last_done_on   AS "lastDoneOn",
         t.interval_value AS "intervalValue",
         t.interval_unit  AS "intervalUnit",
         t.diy
    FROM maintenance_tasks t
    JOIN properties p  ON p.id = t.property_id
    LEFT JOIN assets a ON a.id = t.asset_id
   WHERE p.org_id = $1 AND t.active
  UNION ALL
  SELECT 'consumable',
         c.id,
         a.property_id,
         p.name,
         a.id,
         a.name,
         c.name,
         CASE WHEN c.last_replaced_on IS NULL OR c.interval_value IS NULL THEN NULL
              ELSE add_interval(c.last_replaced_on, c.interval_value, c.interval_unit) END,
         c.last_replaced_on,
         c.interval_value,
         c.interval_unit,
         true
    FROM consumables c
    JOIN assets a     ON a.id = c.asset_id
    JOIN properties p ON p.id = a.property_id
   WHERE p.org_id = $1 AND a.status = 'active'
`

export async function maintenanceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/orgs/:orgId/tasks', async (request): Promise<MaintenanceTask[]> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)
    return query<MaintenanceTask>(`${TASK_SELECT} WHERE p.org_id = $1 ORDER BY p.name, t.name`, [orgId])
  })

  app.post('/properties/:id/tasks', async (request, reply): Promise<MaintenanceTask> => {
    const { id: propertyId } = idParams.parse(request.params)
    const scope = await requireScope(request, 'property', propertyId)
    await assertWritable(scope.orgId)
    const input = taskInput.parse(request.body)

    // A task can hang off an asset, but that asset has to live in the same
    // property the task is filed under.
    if (input.assetId) {
      const owned = await queryOne<{ ok: boolean }>(
        'SELECT true AS ok FROM assets WHERE id = $1 AND property_id = $2',
        [input.assetId, propertyId],
      )
      if (!owned) throw invalid('That asset is in a different property')
    }

    const created = await queryOne<{ id: string }>(
      `INSERT INTO maintenance_tasks
         (property_id, asset_id, name, interval_value, interval_unit, season_month, diy,
          preferred_vendor_id, last_done_on, instructions, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        propertyId,
        input.assetId,
        input.name,
        input.intervalValue,
        input.intervalUnit,
        input.seasonMonth,
        input.diy,
        input.preferredVendorId,
        input.lastDoneOn,
        input.instructions,
        input.active,
      ],
    )
    if (!created) throw notFound('That task')
    const row = await queryOne<MaintenanceTask>(`${TASK_SELECT} WHERE t.id = $1`, [created.id])
    if (!row) throw notFound('That task')
    return reply.status(201).send(row)
  })

  app.put('/tasks/:id', async (request): Promise<MaintenanceTask> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'task', id)
    await assertWritable(scope.orgId)
    const input = taskInput.parse(request.body)

    await query(
      `UPDATE maintenance_tasks
          SET asset_id=$2, name=$3, interval_value=$4, interval_unit=$5, season_month=$6,
              diy=$7, preferred_vendor_id=$8, last_done_on=$9, instructions=$10, active=$11
        WHERE id = $1`,
      [
        id,
        input.assetId,
        input.name,
        input.intervalValue,
        input.intervalUnit,
        input.seasonMonth,
        input.diy,
        input.preferredVendorId,
        input.lastDoneOn,
        input.instructions,
        input.active,
      ],
    )
    const row = await queryOne<MaintenanceTask>(`${TASK_SELECT} WHERE t.id = $1`, [id])
    if (!row) throw notFound('That task')
    return row
  })

  app.delete('/tasks/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'task', id)
    await assertWritable(scope.orgId)
    await query('DELETE FROM maintenance_tasks WHERE id = $1', [id])
    return reply.status(204).send()
  })

  app.get('/orgs/:orgId/due', async (request): Promise<DueItem[]> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)

    type Row = Omit<DueItem, 'status' | 'daysUntilDue'>
    const rows = await query<Row>(DUE_SQL, [orgId])

    const items = rows.map((row) => ({
      ...row,
      status: dueStatus(row.dueOn),
      daysUntilDue: daysFromToday(row.dueOn),
    }))

    // Overdue first, then by how soon, and everything never done at the end -
    // it has no date to sort by and is a backlog rather than a schedule.
    return items.sort((a, b) => {
      if (a.daysUntilDue === null) return b.daysUntilDue === null ? a.itemName.localeCompare(b.itemName) : 1
      if (b.daysUntilDue === null) return -1
      return a.daysUntilDue - b.daysUntilDue
    })
  })

  /**
   * Marks a due item done.
   *
   * Advancing the last-done date and writing the service record happen in one
   * transaction: a completion that did not leave a trail would quietly reset
   * the clock with nothing to show for it.
   */
  app.post('/due/:itemType/:id/complete', async (request, reply) => {
    const { itemType, id } = completeParams.parse(request.params)
    const scope = await requireScope(request, itemType === 'task' ? 'task' : 'consumable', id)
    await assertWritable(scope.orgId)
    const input = completeInput.parse(request.body)

    if (input.vendorId) {
      const owned = await queryOne<{ ok: boolean }>(
        'SELECT true AS ok FROM vendors WHERE id = $1 AND org_id = $2',
        [input.vendorId, scope.orgId],
      )
      if (!owned) throw invalid('That vendor does not belong to this organization')
    }

    await transaction(async (client) => {
      if (itemType === 'task') {
        const task = await queryOne<{ assetId: string | null; name: string }>(
          'UPDATE maintenance_tasks SET last_done_on = $2 WHERE id = $1 RETURNING asset_id AS "assetId", name',
          [id, input.occurredOn],
          client,
        )
        if (!task) throw notFound('That task')

        // service_events hangs off an asset, so a property-level task - the
        // gutters, the septic pump-out - advances its date without a record.
        // Those get logged against an asset only once one is attached.
        if (task.assetId) {
          await client.query(
            `INSERT INTO service_events (asset_id, task_id, kind, occurred_on, vendor_id, cost, summary)
             VALUES ($1, $2, 'maintenance', $3, $4, $5, $6)`,
            [task.assetId, id, input.occurredOn, input.vendorId, input.cost, input.summary],
          )
        }
      } else {
        const consumable = await queryOne<{ assetId: string; name: string }>(
          `UPDATE consumables
              SET last_replaced_on = $2,
                  -- One came off the shelf. Clamped so a miscount cannot go negative.
                  quantity_on_hand = greatest(quantity_on_hand - 1, 0)
            WHERE id = $1
            RETURNING asset_id AS "assetId", name`,
          [id, input.occurredOn],
          client,
        )
        if (!consumable) throw notFound('That consumable')

        await client.query(
          `INSERT INTO service_events
             (asset_id, consumable_id, kind, occurred_on, vendor_id, cost, summary, parts_replaced)
           VALUES ($1, $2, 'maintenance', $3, $4, $5, $6, $7)`,
          [
            consumable.assetId,
            id,
            input.occurredOn,
            input.vendorId,
            input.cost,
            input.summary,
            [consumable.name],
          ],
        )
      }
    })

    return reply.status(204).send()
  })
}
