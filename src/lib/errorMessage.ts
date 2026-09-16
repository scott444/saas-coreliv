import { ServiceError } from '@/services/errors'

/** Human-readable message for any thrown value, favouring ServiceError text. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (ServiceError.is(error)) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
