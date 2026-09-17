/**
 * Error codes are the contract with the UI: `src/services/errors.ts` maps a
 * `{ code, message }` body onto ServiceError, and components branch on the
 * code rather than the status.
 */
export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'limit_exceeded'
  | 'subscription_expired'
  | 'unknown'

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  // Both of these mean "your plan will not let you do that", which is what
  // 402 is for; the code tells the UI which message to show.
  limit_exceeded: 402,
  subscription_expired: 402,
  unknown: 500,
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = STATUS[code]
  }

  static is(error: unknown): error is ApiError {
    return error instanceof ApiError
  }
}

export const unauthorized = (m = 'Sign in to continue') => new ApiError('unauthorized', m)
export const forbidden = (m = 'You do not have access to that') => new ApiError('forbidden', m)
export const notFound = (what = 'That') => new ApiError('not_found', `${what} could not be found`)
export const invalid = (m: string) => new ApiError('validation', m)
export const conflict = (m: string) => new ApiError('conflict', m)
