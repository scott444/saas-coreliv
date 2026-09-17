import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Vendor } from '../../../src/domain/index.js'
import { query, queryOne } from '../db/pool.js'
import { assertWritable } from '../lib/limits.js'
import { notFound } from '../lib/errors.js'
import {
  idParams,
  nullableText,
  orgParams,
  requiredText,
  requireOrg,
  requireScope,
} from './helpers.js'

const vendorInput = z.object({
  name: requiredText(160),
  roles: z
    .array(z.enum(['retailer', 'installer', 'service', 'manufacturer', 'inspector']))
    .max(5)
    .default([])
    .transform((values) => Array.from(new Set(values))),
  phone: nullableText,
  email: nullableText,
  website: nullableText,
  accountNumber: nullableText,
  notes: nullableText,
})

/**
 * `useCount` is what makes deleting a vendor safe to offer: the references
 * themselves are ON DELETE SET NULL, so the UI shows how much history would
 * lose its attribution before anyone confirms.
 */
const VENDOR_SELECT = `
  SELECT v.id, v.name, v.roles, v.phone, v.email, v.website,
         v.account_number AS "accountNumber", v.notes,
         (
           (SELECT count(*)::int FROM assets a WHERE a.retailer_id = v.id OR a.installer_id = v.id)
           + (SELECT count(*)::int FROM service_events e WHERE e.vendor_id = v.id)
           + (SELECT count(*)::int FROM warranties w WHERE w.provider_id = v.id)
           + (SELECT count(*)::int FROM maintenance_tasks t WHERE t.preferred_vendor_id = v.id)
         ) AS "useCount"
    FROM vendors v
`

export async function vendorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/orgs/:orgId/vendors', async (request): Promise<Vendor[]> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)
    return query<Vendor>(`${VENDOR_SELECT} WHERE v.org_id = $1 ORDER BY v.name`, [orgId])
  })

  app.post('/orgs/:orgId/vendors', async (request, reply): Promise<Vendor> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)
    await assertWritable(orgId)
    const input = vendorInput.parse(request.body)

    const created = await queryOne<{ id: string }>(
      `INSERT INTO vendors (org_id, name, roles, phone, email, website, account_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [orgId, input.name, input.roles, input.phone, input.email, input.website, input.accountNumber, input.notes],
    )
    if (!created) throw notFound('That vendor')
    const row = await queryOne<Vendor>(`${VENDOR_SELECT} WHERE v.id = $1`, [created.id])
    if (!row) throw notFound('That vendor')
    return reply.status(201).send(row)
  })

  app.put('/vendors/:id', async (request): Promise<Vendor> => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'vendor', id)
    await assertWritable(scope.orgId)
    const input = vendorInput.parse(request.body)

    await query(
      `UPDATE vendors SET name=$2, roles=$3, phone=$4, email=$5, website=$6, account_number=$7, notes=$8
        WHERE id = $1`,
      [id, input.name, input.roles, input.phone, input.email, input.website, input.accountNumber, input.notes],
    )
    const row = await queryOne<Vendor>(`${VENDOR_SELECT} WHERE v.id = $1`, [id])
    if (!row) throw notFound('That vendor')
    return row
  })

  app.delete('/vendors/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const scope = await requireScope(request, 'vendor', id)
    await assertWritable(scope.orgId)
    // History keeps its shape; the vendor columns just go null.
    await query('DELETE FROM vendors WHERE id = $1', [id])
    return reply.status(204).send()
  })
}
