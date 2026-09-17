import { z } from 'zod'
import type { AuthSession } from '../../../src/domain/index.js'
import { issueSession, type SessionUser } from '../auth/session.js'

export { currentUser, requireOrg, requireScope } from '../auth/scope.js'

export async function issueSessionFor(user: SessionUser): Promise<AuthSession> {
  const { token, expiresAt } = await issueSession(user.id)
  return {
    user: { id: user.id, name: user.name, email: user.email },
    accessToken: token,
    expiresAt,
  }
}

// ---------------------------------------------------------------------------
// Shared field parsers
// ---------------------------------------------------------------------------

export const uuid = z.string().uuid('Not a valid id')

/** `{ id }` route params, which almost every route below takes. */
export const idParams = z.object({ id: uuid })
export const orgParams = z.object({ orgId: uuid })

/**
 * A calendar date, kept as text end to end.
 *
 * Accepting a full ISO timestamp here and truncating would quietly shift the
 * day for anyone not on UTC, so the format is required to be exact.
 */
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Not a real date')

export const nullableDate = dateOnly.nullable().catch(null).default(null)

/** Trims, and treats an empty string as "not provided". */
export const nullableText = z
  .string()
  .trim()
  .max(4000)
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .default(null)

export const requiredText = (max = 200) => z.string().trim().min(1, 'This is required').max(max)

export const money = z
  .number()
  .min(0, 'Cannot be negative')
  .max(99_999_999, 'That is larger than this field holds')
  .nullable()
  .default(null)

export const smallCount = z
  .number()
  .int('Must be a whole number')
  .min(0)
  .max(32_767)
  .nullable()
  .default(null)

export const recurrenceUnit = z.enum(['day', 'week', 'month', 'year'])

/**
 * Coerces the `specs` bag.
 *
 * Values are restricted to the three scalar shapes the spec form can produce,
 * so nothing can smuggle a nested object into a column the UI will try to
 * render as a single line.
 */
export const specs = z
  .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .default({})

export const tags = z
  .array(z.string().trim().min(1).max(40))
  .max(25, 'That is a lot of tags')
  .default([])
  .transform((values) => Array.from(new Set(values)))
