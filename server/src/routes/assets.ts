import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type {
  Asset,
  AssetDetail,
  AssetListEntry,
  Category,
  Consumable,
  HomeDocument,
  IrrigationZone,
  MaintenanceTask,
  NamedRef,
  ReplacementPlan,
  ServiceEvent,
  Vendor,
  Warranty,
} from '../../../src/domain/index.js'
import { bestWarranty } from '../../../src/domain/warranty.js'
import { query, queryOne, transaction, type Queryable } from '../db/pool.js'
import { assertCanAddAsset, assertWritable } from '../lib/limits.js'
import { invalid, notFound } from '../lib/errors.js'
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
  smallCount,
  specs,
  tags,
  uuid,
} from './helpers.js'
import {
  ASSET_SELECT,
  CONSUMABLE_SELECT,
  DOCUMENT_SELECT,
  EVENT_SELECT,
  TASK_SELECT,
  VENDOR_COLUMNS,
  WARRANTY_SELECT,
} from './selects.js'

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

const assetInput = z.object({
  categoryId: uuid.nullable().default(null),
  locationId: uuid.nullable().default(null),
  parentAssetId: uuid.nullable().default(null),
  name: requiredText(160),
  brand: nullableText,
  modelNumber: nullableText,
  serialNumber: nullableText,
  description: nullableText,
  purchaseDate: nullableDate,
  installDate: nullableDate,
  manufactureDate: nullableDate,
  purchaseCost: money,
  installCost: money,
  retailerId: uuid.nullable().default(null),
  installerId: uuid.nullable().default(null),
  expectedLifespanYears: smallCount,
  status: z.enum(['active', 'needs_repair', 'retired', 'replaced']).default('active'),
  replacedById: uuid.nullable().default(null),
  retiredAt: nullableDate,
  specs,
  notes: nullableText,
  tags,
})

const warrantyInput = z
  .object({
    kind: z.enum([
      'manufacturer_parts',
      'manufacturer_labor',
      'installer_labor',
      'extended',
      'home_warranty',
    ]),
    providerId: uuid.nullable().default(null),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date'),
    endDate: nullableDate,
    registered: z.boolean().default(false),
    registrationRef: nullableText,
    transferable: z.boolean().nullable().default(null),
    coverageNotes: nullableText,
    claimPhone: nullableText,
  })
  .refine((v) => v.endDate === null || v.endDate >= v.startDate, {
    message: 'Cover cannot end before it starts',
    path: ['endDate'],
  })

const consumableInput = z
  .object({
    name: requiredText(120),
    partNumber: nullableText,
    sizeOrSpec: nullableText,
    intervalValue: z.number().int().min(1).max(32_767).nullable().default(null),
    intervalUnit: recurrenceUnit.nullable().default(null),
    lastReplacedOn: nullableDate,
    quantityOnHand: z.number().int().min(0).max(32_767).default(0),
    reorderUrl: nullableText,
    unitCost: money,
    notes: nullableText,
  })
  .refine((v) => (v.intervalValue === null) === (v.intervalUnit === null), {
    message: 'Give both a number and a unit, or neither',
    path: ['intervalValue'],
  })

const eventInput = z.object({
  taskId: uuid.nullable().default(null),
  consumableId: uuid.nullable().default(null),
  kind: z.enum(['install', 'maintenance', 'repair', 'inspection', 'replacement', 'recall', 'other']),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date'),
  vendorId: uuid.nullable().default(null),
  technician: nullableText,
  cost: money,
  coveredByWarrantyId: uuid.nullable().default(null),
  summary: requiredText(2000),
  partsReplaced: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  readings: z.record(z.union([z.number(), z.string()])).nullable().default(null),
})

const documentInput = z.object({
  assetId: uuid.nullable().default(null),
  warrantyId: uuid.nullable().default(null),
  serviceEventId: uuid.nullable().default(null),
  kind: z.enum([
    'receipt',
    'manual',
    'data_plate_photo',
    'photo',
    'warranty',
    'permit',
    'invoice',
    'inspection_report',
    'other',
  ]),
  title: requiredText(200),
  storageUrl: z.string().trim().min(1, 'A link or path is required').max(2000),
  mimeType: nullableText,
  capturedOn: nullableDate,
  notes: nullableText,
})

const zoneInput = z.object({
  zoneNumber: z.number().int().min(1).max(999),
  name: requiredText(120),
  headType: nullableText,
  headCount: smallCount,
  valveLocation: nullableText,
  runMinutes: smallCount,
  schedule: z
    .object({ days: z.array(z.string().trim().min(1).max(12)).max(7), start: z.string().trim().max(10) })
    .nullable()
    .default(null),
  notes: nullableText,
})

// ---------------------------------------------------------------------------
// Cross-reference checks
//
// Every id a client can hand us is checked against the organization it landed
// in. Without this, a valid id from someone else's account would attach their
// vendor - or reparent their asset - through a route that only scoped the one
// id in the path.
// ---------------------------------------------------------------------------

async function assertBelongsToOrg(
  orgId: string,
  checks: Array<[label: string, sql: string, id: string | null]>,
  client?: Queryable,
): Promise<void> {
  for (const [label, sql, id] of checks) {
    if (id === null) continue
    const row = await queryOne<{ ok: boolean }>(sql, [id, orgId], client)
    if (!row) throw invalid(`That ${label} does not belong to this organization`)
  }
}

const IN_ORG = {
  vendor: 'SELECT true AS ok FROM vendors WHERE id = $1 AND org_id = $2',
  asset: `SELECT true AS ok FROM assets a JOIN properties p ON p.id = a.property_id
           WHERE a.id = $1 AND p.org_id = $2`,
  location: `SELECT true AS ok FROM locations l JOIN properties p ON p.id = l.property_id
              WHERE l.id = $1 AND p.org_id = $2`,
  category: 'SELECT true AS ok FROM categories WHERE id = $1 AND $2 IS NOT NULL',
} as const

/** A location has to be in the same property as the asset sitting in it. */
async function assertLocationInProperty(
  propertyId: string,
  locationId: string | null,
  client?: Queryable,
): Promise<void> {
  if (locationId === null) return
  const row = await queryOne<{ ok: boolean }>(
    'SELECT true AS ok FROM locations WHERE id = $1 AND property_id = $2',
    [locationId, propertyId],
    client,
  )
  if (!row) throw invalid('That room belongs to a different property')
}

async function validateAssetRefs(
  orgId: string,
  propertyId: string,
  input: z.infer<typeof assetInput>,
  client?: Queryable,
): Promise<void> {
  await assertBelongsToOrg(
    orgId,
    [
      ['category', IN_ORG.category, input.categoryId],
      ['room', IN_ORG.location, input.locationId],
      ['parent asset', IN_ORG.asset, input.parentAssetId],
      ['replacement', IN_ORG.asset, input.replacedById],
      ['retailer', IN_ORG.vendor, input.retailerId],
      ['installer', IN_ORG.vendor, input.installerId],
    ],
    client,
  )
  await assertLocationInProperty(propertyId, input.locationId, client)
}

const ASSET_COLUMNS = `
  category_id, location_id, parent_asset_id, name, brand, model_number, serial_number, description,
  purchase_date, install_date, manufacture_date, purchase_cost, install_cost, retailer_id, installer_id,
  expected_lifespan_years, status, replaced_by_id, retired_at, specs, notes
`

function assetValues(input: z.infer<typeof assetInput>): unknown[] {
  return [
    input.categoryId,
    input.locationId,
    input.parentAssetId,
    input.name,
    input.brand,
    input.modelNumber,
    input.serialNumber,
    input.description,
    input.purchaseDate,
    input.installDate,
    input.manufactureDate,
    input.purchaseCost,
    input.installCost,
    input.retailerId,
    input.installerId,
    input.expectedLifespanYears,
    input.status,
    input.replacedById,
    input.retiredAt,
    JSON.stringify(input.specs),
    input.notes,
  ]
}

async function replaceTags(assetId: string, values: string[], client: Queryable): Promise<void> {
  await client.query('DELETE FROM asset_tags WHERE asset_id = $1', [assetId])
  if (values.length === 0) return
  await client.query(
    'INSERT INTO asset_tags (asset_id, tag) SELECT $1, unnest($2::text[])',
    [assetId, values],
  )
}

async function readAsset(assetId: string, client?: Queryable): Promise<Asset> {
  const row = await queryOne<Asset>(`${ASSET_SELECT} WHERE a.id = $1`, [assetId], client)
  if (!row) throw notFound('That asset')
  return row
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  // Global taxonomy. Public within the app, identical for every organization.
  app.get('/categories', async (): Promise<Category[]> =>
    query<Category>(
      `SELECT id, parent_id AS "parentId", name, slug, spec_schema AS "specSchema", sort_order AS "sortOrder"
         FROM categories ORDER BY sort_order, name`,
    ),
  )

  // -------------------------------------------------------------------------
  // The register
  // -------------------------------------------------------------------------
  app.get('/orgs/:orgId/assets', async (request): Promise<AssetListEntry[]> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)

    const filter = z
      .object({
        propertyId: uuid.optional(),
        categoryId: uuid.optional(),
        status: z.enum(['active', 'needs_repair', 'retired', 'replaced']).optional(),
        warrantyState: z.enum(['unknown', 'active', 'expiring', 'expired', 'lifetime']).optional(),
        search: z.string().trim().max(200).optional(),
      })
      .parse(request.query ?? {})

    const params: unknown[] = [orgId]
    const where = ['p.org_id = $1']

    if (filter.propertyId) {
      params.push(filter.propertyId)
      where.push(`a.property_id = $${params.length}`)
    }
    if (filter.categoryId) {
      params.push(filter.categoryId)
      // Matches a group as well as a leaf, so picking "HVAC" shows furnaces.
      where.push(`(a.category_id = $${params.length} OR c.parent_id = $${params.length})`)
    }
    if (filter.status) {
      params.push(filter.status)
      where.push(`a.status = $${params.length}`)
    }
    if (filter.search) {
      params.push(`%${filter.search}%`)
      const p = `$${params.length}`
      where.push(`(
        a.name ILIKE ${p} OR a.brand ILIKE ${p} OR a.model_number ILIKE ${p}
        OR a.serial_number ILIKE ${p} OR c.name ILIKE ${p} OR l.name ILIKE ${p}
        OR EXISTS (SELECT 1 FROM asset_tags t WHERE t.asset_id = a.id AND t.tag ILIKE ${p})
      )`)
    }

    interface Row extends Omit<AssetListEntry, 'warranty'> {
      warrantyItems: Array<{ id: string; endDate: string | null }> | null
    }

    const rows = await query<Row>(
      `SELECT a.id,
              a.property_id AS "propertyId",
              p.name        AS "propertyName",
              a.name, a.brand,
              a.model_number  AS "modelNumber",
              a.serial_number AS "serialNumber",
              a.category_id   AS "categoryId",
              c.name          AS "categoryName",
              c.slug          AS "categorySlug",
              g.name          AS "groupName",
              l.name          AS "locationName",
              a.status,
              a.install_date  AS "installDate",
              a.purchase_date AS "purchaseDate",
              a.expected_lifespan_years AS "expectedLifespanYears",
              (SELECT max(e.occurred_on) FROM service_events e WHERE e.asset_id = a.id) AS "lastServicedOn",
              (SELECT count(*)::int FROM documents d WHERE d.asset_id = a.id) AS "documentCount",
              (
                (SELECT count(*)::int FROM consumables cc
                  WHERE cc.asset_id = a.id AND cc.last_replaced_on IS NOT NULL AND cc.interval_value IS NOT NULL
                    AND add_interval(cc.last_replaced_on, cc.interval_value, cc.interval_unit) <= current_date)
                +
                (SELECT count(*)::int FROM maintenance_tasks tt
                  WHERE tt.asset_id = a.id AND tt.active AND tt.last_done_on IS NOT NULL
                    AND add_interval(tt.last_done_on, tt.interval_value, tt.interval_unit) <= current_date)
              ) AS "openItemCount",
              COALESCE((SELECT array_agg(t.tag ORDER BY t.tag) FROM asset_tags t WHERE t.asset_id = a.id), '{}') AS tags,
              (SELECT json_agg(json_build_object('id', w.id, 'endDate', w.end_date))
                 FROM warranties w WHERE w.asset_id = a.id) AS "warrantyItems"
         FROM assets a
         JOIN properties p      ON p.id = a.property_id
         LEFT JOIN categories c ON c.id = a.category_id
         LEFT JOIN categories g ON g.id = c.parent_id
         LEFT JOIN locations l  ON l.id = a.location_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.name, g.sort_order NULLS LAST, c.sort_order NULLS LAST, a.name`,
      params,
    )

    const entries = rows.map(({ warrantyItems, ...row }) => ({
      ...row,
      // Derived here, with the same function the UI uses for a single asset,
      // rather than reimplemented in SQL - one definition of "in warranty".
      warranty: bestWarranty(warrantyItems ?? []),
    }))

    return filter.warrantyState
      ? entries.filter((entry) => entry.warranty.state === filter.warrantyState)
      : entries
  })

  app.get('/orgs/:orgId/replacement-plan', async (request) => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)
    return query<ReplacementPlan & { assetId: string; assetName: string; propertyName: string }>(
      `SELECT v.id AS "assetId", v.name AS "assetName", p.name AS "propertyName",
              v.in_service_date         AS "inServiceDate",
              v.age_years               AS "ageYears",
              v.expected_lifespan_years AS "expectedLifespanYears",
              v.projected_replacement   AS "projectedReplacement",
              v.acquisition_cost        AS "acquisitionCost",
              v.lifetime_service_cost   AS "lifetimeServiceCost"
         FROM v_replacement_planning v
         JOIN properties p ON p.id = v.property_id
        WHERE v.org_id = $1
        ORDER BY v.projected_replacement NULLS LAST`,
      [orgId],
    )
  })

  // -------------------------------------------------------------------------
  // One asset, whole
  // -------------------------------------------------------------------------
  app.get('/assets/:id', async (request): Promise<AssetDetail> => {
    const { id } = idParams.parse(request.params)
    await requireScope(request, 'asset', id)

    const asset = await readAsset(id)

    const [context, warranties, consumables, tasks, events, documents, zones, plan, children] =
      await Promise.all([
        queryOne<{
          propertyId: string
          propertyName: string
          categoryId: string | null
          categoryName: string | null
          categorySlug: string | null
          specSchema: unknown
          categoryParentId: string | null
          categorySortOrder: number | null
          groupName: string | null
          locationId: string | null
          locationName: string | null
          parentId: string | null
          parentName: string | null
          replacedById: string | null
          replacedByName: string | null
        }>(
          `SELECT a.property_id AS "propertyId", p.name AS "propertyName",
                  c.id AS "categoryId", c.name AS "categoryName", c.slug AS "categorySlug",
                  c.spec_schema AS "specSchema", c.parent_id AS "categoryParentId",
                  c.sort_order AS "categorySortOrder",
                  g.name AS "groupName",
                  l.id AS "locationId", l.name AS "locationName",
                  par.id AS "parentId", par.name AS "parentName",
                  rep.id AS "replacedById", rep.name AS "replacedByName"
             FROM assets a
             JOIN properties p      ON p.id = a.property_id
             LEFT JOIN categories c ON c.id = a.category_id
             LEFT JOIN categories g ON g.id = c.parent_id
             LEFT JOIN locations l  ON l.id = a.location_id
             LEFT JOIN assets par   ON par.id = a.parent_asset_id
             LEFT JOIN assets rep   ON rep.id = a.replaced_by_id
            WHERE a.id = $1`,
          [id],
        ),
        query<Warranty>(`${WARRANTY_SELECT} WHERE w.asset_id = $1 ORDER BY w.end_date NULLS FIRST`, [id]),
        query<Consumable>(`${CONSUMABLE_SELECT} WHERE c.asset_id = $1 ORDER BY c.name`, [id]),
        query<MaintenanceTask>(`${TASK_SELECT} WHERE t.asset_id = $1 ORDER BY t.name`, [id]),
        query<ServiceEvent>(`${EVENT_SELECT} WHERE e.asset_id = $1 ORDER BY e.occurred_on DESC, e.created_at DESC`, [id]),
        query<HomeDocument>(`${DOCUMENT_SELECT} WHERE d.asset_id = $1 ORDER BY d.created_at DESC`, [id]),
        query<IrrigationZone>(
          `SELECT id, controller_asset_id AS "controllerAssetId", zone_number AS "zoneNumber", name,
                  head_type AS "headType", head_count AS "headCount", valve_location AS "valveLocation",
                  run_minutes AS "runMinutes", schedule, notes
             FROM irrigation_zones WHERE controller_asset_id = $1 ORDER BY zone_number`,
          [id],
        ),
        queryOne<ReplacementPlan>(
          `SELECT in_service_date AS "inServiceDate", age_years AS "ageYears",
                  expected_lifespan_years AS "expectedLifespanYears",
                  projected_replacement AS "projectedReplacement",
                  acquisition_cost AS "acquisitionCost", lifetime_service_cost AS "lifetimeServiceCost"
             FROM v_replacement_planning WHERE id = $1`,
          [id],
        ),
        query<NamedRef>('SELECT id, name FROM assets WHERE parent_asset_id = $1 ORDER BY name', [id]),
      ])

    if (!context) throw notFound('That asset')

    const [retailer, installer] = await Promise.all([
      asset.retailerId ? readVendor(asset.retailerId) : Promise.resolve(null),
      asset.installerId ? readVendor(asset.installerId) : Promise.resolve(null),
    ])

    return {
      asset,
      property: { id: context.propertyId, name: context.propertyName },
      category: context.categoryId
        ? {
            id: context.categoryId,
            parentId: context.categoryParentId,
            name: context.categoryName ?? '',
            slug: context.categorySlug ?? '',
            specSchema: (context.specSchema as Category['specSchema']) ?? [],
            sortOrder: context.categorySortOrder ?? 0,
          }
        : null,
      groupName: context.groupName,
      location:
        context.locationId && context.locationName
          ? { id: context.locationId, name: context.locationName }
          : null,
      parent:
        context.parentId && context.parentName
          ? { id: context.parentId, name: context.parentName }
          : null,
      children,
      retailer,
      installer,
      replacedBy:
        context.replacedById && context.replacedByName
          ? { id: context.replacedById, name: context.replacedByName }
          : null,
      warranties,
      consumables,
      tasks,
      events,
      documents,
      irrigationZones: zones,
      // The view excludes retired assets, so fall back to an empty plan rather
      // than making the page 404 for something that simply has no projection.
      replacement: plan ?? {
        inServiceDate: null,
        ageYears: null,
        expectedLifespanYears: asset.expectedLifespanYears,
        projectedReplacement: null,
        acquisitionCost: (asset.purchaseCost ?? 0) + (asset.installCost ?? 0),
        lifetimeServiceCost: 0,
      },
    }
  })

  app.post('/properties/:id/assets', async (request, reply): Promise<Asset> => {
    const { id: propertyId } = idParams.parse(request.params)
    const scope = await requireScope(request, 'property', propertyId)
    await assertCanAddAsset(scope.orgId)
    const input = assetInput.parse(request.body)
    await validateAssetRefs(scope.orgId, propertyId, input)

    const created = await transaction(async (client) => {
      const values = assetValues(input)
      const placeholders = values.map((_, i) => `$${i + 2}`).join(', ')
      const row = await queryOne<{ id: string }>(
        `INSERT INTO assets (property_id, ${ASSET_COLUMNS}) VALUES ($1, ${placeholders}) RETURNING id`,
        [propertyId, ...values],
        client,
      )
      if (!row) throw notFound('That asset')
      await replaceTags(row.id, input.tags, client)
      return row.id
    })

    return reply.status(201).send(await readAsset(created))
  })

  app.put('/assets/:id', async (request): Promise<Asset> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'asset', id)
    await assertWritable(scope.orgId)
    const input = assetInput.parse(request.body)

    const current = await queryOne<{ propertyId: string }>(
      'SELECT property_id AS "propertyId" FROM assets WHERE id = $1',
      [id],
    )
    if (!current) throw notFound('That asset')
    if (input.parentAssetId === id) throw invalid('An asset cannot be its own parent')
    if (input.replacedById === id) throw invalid('An asset cannot replace itself')
    await validateAssetRefs(scope.orgId, current.propertyId, input)

    await transaction(async (client) => {
      const values = assetValues(input)
      const assignments = ASSET_COLUMNS.split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((column, i) => `${column} = $${i + 2}`)
        .join(', ')
      await client.query(`UPDATE assets SET ${assignments} WHERE id = $1`, [id, ...values])
      await replaceTags(id, input.tags, client)
    })

    return readAsset(id)
  })

  app.delete('/assets/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'asset', id)
    await assertWritable(scope.orgId)
    await query('DELETE FROM assets WHERE id = $1', [id])
    return reply.status(204).send()
  })

  // -------------------------------------------------------------------------
  // Warranties
  // -------------------------------------------------------------------------
  app.post('/assets/:id/warranties', async (request, reply): Promise<Warranty> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'asset', id)
    await assertWritable(scope.orgId)
    const input = warrantyInput.parse(request.body)
    await assertBelongsToOrg(scope.orgId, [['provider', IN_ORG.vendor, input.providerId]])

    const created = await queryOne<{ id: string }>(
      `INSERT INTO warranties
         (asset_id, kind, provider_id, start_date, end_date, registered, registration_ref,
          transferable, coverage_notes, claim_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        id,
        input.kind,
        input.providerId,
        input.startDate,
        input.endDate,
        input.registered,
        input.registrationRef,
        input.transferable,
        input.coverageNotes,
        input.claimPhone,
      ],
    )
    if (!created) throw notFound('That warranty')
    const row = await queryOne<Warranty>(`${WARRANTY_SELECT} WHERE w.id = $1`, [created.id])
    if (!row) throw notFound('That warranty')
    return reply.status(201).send(row)
  })

  app.put('/warranties/:id', async (request): Promise<Warranty> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'warranty', id)
    await assertWritable(scope.orgId)
    const input = warrantyInput.parse(request.body)
    await assertBelongsToOrg(scope.orgId, [['provider', IN_ORG.vendor, input.providerId]])

    await query(
      `UPDATE warranties SET kind=$2, provider_id=$3, start_date=$4, end_date=$5, registered=$6,
              registration_ref=$7, transferable=$8, coverage_notes=$9, claim_phone=$10
        WHERE id = $1`,
      [
        id,
        input.kind,
        input.providerId,
        input.startDate,
        input.endDate,
        input.registered,
        input.registrationRef,
        input.transferable,
        input.coverageNotes,
        input.claimPhone,
      ],
    )
    const row = await queryOne<Warranty>(`${WARRANTY_SELECT} WHERE w.id = $1`, [id])
    if (!row) throw notFound('That warranty')
    return row
  })

  app.delete('/warranties/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'warranty', id)
    await assertWritable(scope.orgId)
    await query('DELETE FROM warranties WHERE id = $1', [id])
    return reply.status(204).send()
  })

  // -------------------------------------------------------------------------
  // Consumables
  // -------------------------------------------------------------------------
  app.post('/assets/:id/consumables', async (request, reply): Promise<Consumable> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'asset', id)
    await assertWritable(scope.orgId)
    const input = consumableInput.parse(request.body)

    const created = await queryOne<{ id: string }>(
      `INSERT INTO consumables
         (asset_id, name, part_number, size_or_spec, interval_value, interval_unit,
          last_replaced_on, quantity_on_hand, reorder_url, unit_cost, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        id,
        input.name,
        input.partNumber,
        input.sizeOrSpec,
        input.intervalValue,
        input.intervalUnit,
        input.lastReplacedOn,
        input.quantityOnHand,
        input.reorderUrl,
        input.unitCost,
        input.notes,
      ],
    )
    if (!created) throw notFound('That consumable')
    const row = await queryOne<Consumable>(`${CONSUMABLE_SELECT} WHERE c.id = $1`, [created.id])
    if (!row) throw notFound('That consumable')
    return reply.status(201).send(row)
  })

  app.put('/consumables/:id', async (request): Promise<Consumable> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'consumable', id)
    await assertWritable(scope.orgId)
    const input = consumableInput.parse(request.body)

    await query(
      `UPDATE consumables SET name=$2, part_number=$3, size_or_spec=$4, interval_value=$5,
              interval_unit=$6, last_replaced_on=$7, quantity_on_hand=$8, reorder_url=$9,
              unit_cost=$10, notes=$11
        WHERE id = $1`,
      [
        id,
        input.name,
        input.partNumber,
        input.sizeOrSpec,
        input.intervalValue,
        input.intervalUnit,
        input.lastReplacedOn,
        input.quantityOnHand,
        input.reorderUrl,
        input.unitCost,
        input.notes,
      ],
    )
    const row = await queryOne<Consumable>(`${CONSUMABLE_SELECT} WHERE c.id = $1`, [id])
    if (!row) throw notFound('That consumable')
    return row
  })

  app.delete('/consumables/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'consumable', id)
    await assertWritable(scope.orgId)
    await query('DELETE FROM consumables WHERE id = $1', [id])
    return reply.status(204).send()
  })

  // -------------------------------------------------------------------------
  // Service history
  // -------------------------------------------------------------------------
  app.post('/assets/:id/events', async (request, reply): Promise<ServiceEvent> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'asset', id)
    await assertWritable(scope.orgId)
    const input = eventInput.parse(request.body)
    await assertBelongsToOrg(scope.orgId, [['vendor', IN_ORG.vendor, input.vendorId]])

    const created = await queryOne<{ id: string }>(
      `INSERT INTO service_events
         (asset_id, task_id, consumable_id, kind, occurred_on, vendor_id, technician, cost,
          covered_by_warranty_id, summary, parts_replaced, readings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        id,
        input.taskId,
        input.consumableId,
        input.kind,
        input.occurredOn,
        input.vendorId,
        input.technician,
        input.cost,
        input.coveredByWarrantyId,
        input.summary,
        input.partsReplaced,
        input.readings === null ? null : JSON.stringify(input.readings),
      ],
    )
    if (!created) throw notFound('That service record')
    const row = await queryOne<ServiceEvent>(`${EVENT_SELECT} WHERE e.id = $1`, [created.id])
    if (!row) throw notFound('That service record')
    return reply.status(201).send(row)
  })

  app.delete('/events/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'event', id)
    await assertWritable(scope.orgId)
    await query('DELETE FROM service_events WHERE id = $1', [id])
    return reply.status(204).send()
  })

  // -------------------------------------------------------------------------
  // Documents
  // -------------------------------------------------------------------------
  app.post('/properties/:id/documents', async (request, reply): Promise<HomeDocument> => {
    const { id: propertyId } = idParams.parse(request.params)
    const scope = await requireScope(request, 'property', propertyId)
    await assertWritable(scope.orgId)
    const input = documentInput.parse(request.body)
    await assertBelongsToOrg(scope.orgId, [['asset', IN_ORG.asset, input.assetId]])

    const created = await queryOne<{ id: string }>(
      `INSERT INTO documents
         (property_id, asset_id, warranty_id, service_event_id, kind, title, storage_url,
          mime_type, captured_on, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        propertyId,
        input.assetId,
        input.warrantyId,
        input.serviceEventId,
        input.kind,
        input.title,
        input.storageUrl,
        input.mimeType,
        input.capturedOn,
        input.notes,
      ],
    )
    if (!created) throw notFound('That document')
    const row = await queryOne<HomeDocument>(`${DOCUMENT_SELECT} WHERE d.id = $1`, [created.id])
    if (!row) throw notFound('That document')
    return reply.status(201).send(row)
  })

  app.delete('/documents/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'document', id)
    await assertWritable(scope.orgId)
    await query('DELETE FROM documents WHERE id = $1', [id])
    return reply.status(204).send()
  })

  // -------------------------------------------------------------------------
  // Irrigation zones
  // -------------------------------------------------------------------------
  const ZONE_SELECT = `
    SELECT id, controller_asset_id AS "controllerAssetId", zone_number AS "zoneNumber", name,
           head_type AS "headType", head_count AS "headCount", valve_location AS "valveLocation",
           run_minutes AS "runMinutes", schedule, notes
      FROM irrigation_zones
  `

  app.get('/assets/:id/zones', async (request): Promise<IrrigationZone[]> => {
    const { id } = idParams.parse(request.params)
    await requireScope(request, 'asset', id)
    return query<IrrigationZone>(`${ZONE_SELECT} WHERE controller_asset_id = $1 ORDER BY zone_number`, [id])
  })

  app.put('/assets/:id/zones', async (request): Promise<IrrigationZone> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'asset', id)
    await assertWritable(scope.orgId)
    const input = zoneInput.parse(request.body)

    // Upsert on (controller, zone number): the zone number is the natural key
    // on a controller, so saving zone 3 twice edits it rather than duplicating.
    const row = await queryOne<IrrigationZone>(
      `INSERT INTO irrigation_zones
         (controller_asset_id, zone_number, name, head_type, head_count, valve_location, run_minutes, schedule, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (controller_asset_id, zone_number) DO UPDATE
         SET name = EXCLUDED.name, head_type = EXCLUDED.head_type, head_count = EXCLUDED.head_count,
             valve_location = EXCLUDED.valve_location, run_minutes = EXCLUDED.run_minutes,
             schedule = EXCLUDED.schedule, notes = EXCLUDED.notes
       RETURNING id, controller_asset_id AS "controllerAssetId", zone_number AS "zoneNumber", name,
                 head_type AS "headType", head_count AS "headCount", valve_location AS "valveLocation",
                 run_minutes AS "runMinutes", schedule, notes`,
      [
        id,
        input.zoneNumber,
        input.name,
        input.headType,
        input.headCount,
        input.valveLocation,
        input.runMinutes,
        input.schedule === null ? null : JSON.stringify(input.schedule),
        input.notes,
      ],
    )
    if (!row) throw notFound('That zone')
    return row
  })

  app.delete('/zones/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'zone', id)
    await assertWritable(scope.orgId)
    await query('DELETE FROM irrigation_zones WHERE id = $1', [id])
    return reply.status(204).send()
  })
}

/**
 * The retailer and installer shown on an asset page.
 *
 * Uses the shared columns - including the roles cast - rather than its own
 * list; `useCount` is not worth four subqueries on this path, so it is
 * reported as zero and the vendors page is where that number is shown.
 */
async function readVendor(vendorId: string): Promise<Vendor | null> {
  return queryOne<Vendor>(
    `SELECT ${VENDOR_COLUMNS}, 0 AS "useCount" FROM vendors v WHERE v.id = $1`,
    [vendorId],
  )
}
