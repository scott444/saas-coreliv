import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AccessPoint, Location, Property } from '../../../src/domain/index.js'
import { query, queryOne } from '../db/pool.js'
import { assertCanAddProperty, assertWritable } from '../lib/limits.js'
import { notFound } from '../lib/errors.js'
import {
  idParams,
  nullableDate,
  nullableText,
  orgParams,
  requiredText,
  requireOrg,
  requireScope,
  uuid,
} from './helpers.js'

const propertyInput = z.object({
  name: requiredText(120),
  address: nullableText,
  yearBuilt: z
    .number()
    .int()
    .min(1500, 'That is earlier than this field holds')
    .max(new Date().getFullYear() + 5, 'That is in the future')
    .nullable()
    .default(null),
  purchaseDate: nullableDate,
  notes: nullableText,
})

const locationInput = z.object({
  name: requiredText(120),
  floor: nullableText,
})

const accessPointInput = z.object({
  assetId: uuid.nullable().default(null),
  locationId: uuid.nullable().default(null),
  kind: requiredText(60),
  label: requiredText(160),
  description: nullableText,
  photoDocumentId: uuid.nullable().default(null),
})

/**
 * Counts shown next to each property.
 *
 * `openItemCount` is anything already due - overdue tasks and overdue
 * consumables together - because that is the number worth putting on a
 * switcher; everything else is just inventory.
 */
const PROPERTY_SELECT = `
  SELECT p.id, p.name, p.address,
         p.year_built    AS "yearBuilt",
         p.purchase_date AS "purchaseDate",
         p.notes,
         p.created_at    AS "createdAt",
         (SELECT count(*)::int FROM assets a WHERE a.property_id = p.id) AS "assetCount",
         (
           (SELECT count(*)::int FROM maintenance_tasks t
             WHERE t.property_id = p.id AND t.active
               AND t.last_done_on IS NOT NULL
               AND add_interval(t.last_done_on, t.interval_value, t.interval_unit) <= current_date)
           +
           (SELECT count(*)::int FROM consumables c
              JOIN assets a ON a.id = c.asset_id
             WHERE a.property_id = p.id AND a.status = 'active'
               AND c.last_replaced_on IS NOT NULL AND c.interval_value IS NOT NULL
               AND add_interval(c.last_replaced_on, c.interval_value, c.interval_unit) <= current_date)
         ) AS "openItemCount"
    FROM properties p
`

export async function propertyRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Properties
  // -------------------------------------------------------------------------
  app.get('/orgs/:orgId/properties', async (request): Promise<Property[]> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)
    return query<Property>(`${PROPERTY_SELECT} WHERE p.org_id = $1 ORDER BY p.created_at`, [orgId])
  })

  app.post('/orgs/:orgId/properties', async (request, reply): Promise<Property> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId, 'admin')
    await assertCanAddProperty(orgId)
    const input = propertyInput.parse(request.body)

    const created = await queryOne<{ id: string }>(
      `INSERT INTO properties (org_id, name, address, year_built, purchase_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [orgId, input.name, input.address, input.yearBuilt, input.purchaseDate, input.notes],
    )
    if (!created) throw notFound('That property')

    const row = await queryOne<Property>(`${PROPERTY_SELECT} WHERE p.id = $1`, [created.id])
    if (!row) throw notFound('That property')
    return reply.status(201).send(row)
  })

  app.put('/properties/:id', async (request): Promise<Property> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'property', id, 'admin')
    await assertWritable(scope.orgId)
    const input = propertyInput.parse(request.body)

    await query(
      `UPDATE properties SET name = $2, address = $3, year_built = $4, purchase_date = $5, notes = $6
        WHERE id = $1`,
      [id, input.name, input.address, input.yearBuilt, input.purchaseDate, input.notes],
    )

    const row = await queryOne<Property>(`${PROPERTY_SELECT} WHERE p.id = $1`, [id])
    if (!row) throw notFound('That property')
    return row
  })

  app.delete('/properties/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'property', id, 'admin')
    await assertWritable(scope.orgId)
    // Every asset, warranty, task and document under it goes too, by the
    // cascades on the schema. That is the intended behaviour - a property is
    // the root of its own record - so the UI confirms with the asset count.
    await query('DELETE FROM properties WHERE id = $1', [id])
    return reply.status(204).send()
  })

  // -------------------------------------------------------------------------
  // Locations
  // -------------------------------------------------------------------------
  app.get('/properties/:id/locations', async (request): Promise<Location[]> => {
    const { id } = idParams.parse(request.params)
    await requireScope(request, 'property', id)
    return query<Location>(
      `SELECT l.id, l.property_id AS "propertyId", l.name, l.floor,
              (SELECT count(*)::int FROM assets a WHERE a.location_id = l.id) AS "assetCount"
         FROM locations l WHERE l.property_id = $1 ORDER BY l.floor NULLS LAST, l.name`,
      [id],
    )
  })

  app.post('/properties/:id/locations', async (request, reply): Promise<Location> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'property', id)
    await assertWritable(scope.orgId)
    const input = locationInput.parse(request.body)

    const row = await queryOne<Location>(
      `INSERT INTO locations (property_id, name, floor) VALUES ($1, $2, $3)
       RETURNING id, property_id AS "propertyId", name, floor, 0 AS "assetCount"`,
      [id, input.name, input.floor],
    )
    if (!row) throw notFound('That location')
    return reply.status(201).send(row)
  })

  app.put('/locations/:id', async (request): Promise<Location> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'location', id)
    await assertWritable(scope.orgId)
    const input = locationInput.parse(request.body)

    const row = await queryOne<Location>(
      `UPDATE locations SET name = $2, floor = $3 WHERE id = $1
       RETURNING id, property_id AS "propertyId", name, floor,
                 (SELECT count(*)::int FROM assets a WHERE a.location_id = locations.id) AS "assetCount"`,
      [id, input.name, input.floor],
    )
    if (!row) throw notFound('That location')
    return row
  })

  app.delete('/locations/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'location', id)
    await assertWritable(scope.orgId)
    // Assets keep existing with no location rather than disappearing with it.
    await query('DELETE FROM locations WHERE id = $1', [id])
    return reply.status(204).send()
  })

  // -------------------------------------------------------------------------
  // Access points: shutoffs, valves, breakers
  // -------------------------------------------------------------------------
  const ACCESS_POINT_SELECT = `
    SELECT ap.id, ap.property_id AS "propertyId", ap.asset_id AS "assetId", a.name AS "assetName",
           ap.location_id AS "locationId", l.name AS "locationName",
           ap.kind, ap.label, ap.description, ap.photo_document_id AS "photoDocumentId"
      FROM access_points ap
      LEFT JOIN assets a    ON a.id = ap.asset_id
      LEFT JOIN locations l ON l.id = ap.location_id
  `

  app.get('/properties/:id/access-points', async (request): Promise<AccessPoint[]> => {
    const { id } = idParams.parse(request.params)
    await requireScope(request, 'property', id)
    return query<AccessPoint>(`${ACCESS_POINT_SELECT} WHERE ap.property_id = $1 ORDER BY ap.kind, ap.label`, [id])
  })

  app.post('/properties/:id/access-points', async (request, reply): Promise<AccessPoint> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'property', id)
    await assertWritable(scope.orgId)
    const input = accessPointInput.parse(request.body)

    const created = await queryOne<{ id: string }>(
      `INSERT INTO access_points (property_id, asset_id, location_id, kind, label, description, photo_document_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [id, input.assetId, input.locationId, input.kind, input.label, input.description, input.photoDocumentId],
    )
    if (!created) throw notFound('That access point')
    const row = await queryOne<AccessPoint>(`${ACCESS_POINT_SELECT} WHERE ap.id = $1`, [created.id])
    if (!row) throw notFound('That access point')
    return reply.status(201).send(row)
  })

  app.put('/access-points/:id', async (request): Promise<AccessPoint> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'accessPoint', id)
    await assertWritable(scope.orgId)
    const input = accessPointInput.parse(request.body)

    await query(
      `UPDATE access_points
          SET asset_id = $2, location_id = $3, kind = $4, label = $5, description = $6, photo_document_id = $7
        WHERE id = $1`,
      [id, input.assetId, input.locationId, input.kind, input.label, input.description, input.photoDocumentId],
    )
    const row = await queryOne<AccessPoint>(`${ACCESS_POINT_SELECT} WHERE ap.id = $1`, [id])
    if (!row) throw notFound('That access point')
    return row
  })

  app.delete('/access-points/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'accessPoint', id)
    await assertWritable(scope.orgId)
    await query('DELETE FROM access_points WHERE id = $1', [id])
    return reply.status(204).send()
  })
}
