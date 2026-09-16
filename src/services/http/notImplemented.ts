import { ServiceError } from '../errors'

export function notImplemented(service: string, method: string): never {
  throw new ServiceError('unknown', service + '.' + method + ' is not implemented for VITE_DATA_MODE=http yet', 501)
}
