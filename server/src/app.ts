import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { env } from './env.js'
import { ApiError } from './lib/errors.js'
import { PG_CHECK_VIOLATION, PG_FOREIGN_KEY_VIOLATION, PG_UNIQUE_VIOLATION, pgErrorCode } from './db/pool.js'
import { resolveSession, type SessionUser } from './auth/session.js'
import { authRoutes } from './routes/auth.js'
import { organizationRoutes } from './routes/organizations.js'
import { billingRoutes } from './routes/billing.js'
import { propertyRoutes } from './routes/properties.js'
import { assetRoutes } from './routes/assets.js'
import { maintenanceRoutes } from './routes/maintenance.js'
import { vendorRoutes } from './routes/vendors.js'
import { documentRoutes } from './routes/documents.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the bearer-token hook; absent for anonymous requests. */
    sessionUser?: SessionUser
    /** The raw token, kept so /auth/logout can revoke exactly this session. */
    sessionToken?: string
  }
}

/** Routes reachable without a session. Everything else needs a bearer token. */
const PUBLIC_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/auth/register',
  'GET /api/billing/plans',
  'GET /healthz',
])

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.logLevel },
    // Behind nginx, so trust the forwarded headers for request logging.
    trustProxy: true,
    disableRequestLogging: false,
  })

  if (env.corsOrigins.length > 0) {
    await app.register(cors, { origin: env.corsOrigins, credentials: true })
  }

  // -------------------------------------------------------------------------
  // Authentication
  //
  // One hook rather than a per-route guard: a route added without a guard
  // would otherwise be public by accident. New routes are private by default
  // and have to be named in PUBLIC_ROUTES to opt out.
  // -------------------------------------------------------------------------
  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization
    if (header?.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim()
      const user = await resolveSession(token)
      if (user) {
        request.sessionUser = user
        request.sessionToken = token
      }
    }

    const key = `${request.method} ${request.routeOptions?.url ?? request.url}`
    if (PUBLIC_ROUTES.has(key)) return

    // /auth/me answers "am I signed in?", so it returns null rather than 401.
    if (key === 'GET /api/auth/me') return

    if (!request.sessionUser) throw new ApiError('unauthorized', 'Sign in to continue')
  })

  // -------------------------------------------------------------------------
  // Error shape
  //
  // The UI maps `{ code, message }` onto ServiceError and branches on the
  // code, so every failure leaves here in that shape - including the ones
  // Postgres and Zod raise.
  // -------------------------------------------------------------------------
  app.setErrorHandler((error, request, reply) => {
    if (ApiError.is(error)) {
      return reply.status(error.status).send({ code: error.code, message: error.message })
    }

    if (error instanceof ZodError) {
      const first = error.issues[0]
      const path = first?.path.join('.')
      const message = first ? (path ? `${path}: ${first.message}` : first.message) : 'Invalid request'
      return reply.status(422).send({ code: 'validation', message })
    }

    switch (pgErrorCode(error)) {
      case PG_UNIQUE_VIOLATION:
        return reply.status(409).send({ code: 'conflict', message: 'That already exists' })
      case PG_FOREIGN_KEY_VIOLATION:
        return reply
          .status(422)
          .send({ code: 'validation', message: 'That refers to something which does not exist' })
      case PG_CHECK_VIOLATION:
        return reply
          .status(422)
          .send({ code: 'validation', message: 'Those values are not a valid combination' })
    }

    // Fastify's own 4xx (bad JSON body, unknown route) should not read as a
    // server fault.
    const fastifyError = error as { statusCode?: unknown; message?: unknown }
    const status = typeof fastifyError.statusCode === 'number' ? fastifyError.statusCode : 500
    if (status >= 400 && status < 500) {
      const message =
        typeof fastifyError.message === 'string' ? fastifyError.message : 'Invalid request'
      return reply.status(status).send({ code: 'validation', message })
    }

    request.log.error({ err: error }, 'unhandled error')
    return reply.status(500).send({ code: 'unknown', message: 'Something went wrong' })
  })

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ code: 'not_found', message: 'No such endpoint' })
  })

  app.get('/healthz', async () => ({ status: 'ok' }))

  await app.register(
    async (api) => {
      await api.register(authRoutes)
      await api.register(organizationRoutes)
      await api.register(billingRoutes)
      await api.register(propertyRoutes)
      await api.register(assetRoutes)
      await api.register(maintenanceRoutes)
      await api.register(vendorRoutes)
      await api.register(documentRoutes)
    },
    { prefix: '/api' },
  )

  return app
}
