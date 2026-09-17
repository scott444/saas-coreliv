import type { FastifyInstance } from 'fastify'
import type { HomeDocument } from '../../../src/domain/index.js'
import { query } from '../db/pool.js'
import { DOCUMENT_SELECT } from './selects.js'
import { orgParams, requireOrg } from './helpers.js'

/**
 * Reading documents is org-wide; writing one always attaches it to an asset or
 * a property, so those routes live with assets.
 *
 * `storageUrl` is a link the user supplies - a Drive file, a manufacturer PDF,
 * a path into whatever bucket gets wired up later. Accepting uploads means a
 * presigned-URL endpoint and a size and type policy, which is the next thing
 * to land in this file.
 */
export async function documentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/orgs/:orgId/documents', async (request): Promise<HomeDocument[]> => {
    const { orgId } = orgParams.parse(request.params)
    await requireOrg(request, orgId)
    return query<HomeDocument>(
      `${DOCUMENT_SELECT} JOIN properties p ON p.id = d.property_id
        WHERE p.org_id = $1 ORDER BY d.created_at DESC`,
      [orgId],
    )
  })
}
