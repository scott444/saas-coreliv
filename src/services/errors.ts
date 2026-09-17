export type ServiceErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'limit_exceeded'
  | 'subscription_expired'
  | 'network'
  | 'unknown'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode
  readonly status: number

  constructor(code: ServiceErrorCode, message: string, status = 500) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.status = status
  }

  static is(error: unknown): error is ServiceError {
    return error instanceof ServiceError
  }
}

export interface ApiErrorBody {
  code: ServiceErrorCode
  message: string
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as ApiErrorBody).message === 'string'
  )
}

export function toServiceError(error: unknown): ServiceError {
  if (ServiceError.is(error)) return error
  if (error instanceof TypeError) return new ServiceError('network', 'Network request failed', 0)
  if (error instanceof Error) return new ServiceError('unknown', error.message)
  return new ServiceError('unknown', 'Something went wrong')
}
