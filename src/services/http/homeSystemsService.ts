import type { HomeSystemsService } from '../types'
import type { ApiClient } from '../apiClient'
import { notImplemented } from './notImplemented'

export function createHttpHomeSystemsService(_client: ApiClient): HomeSystemsService {
  return {
    listHomes: () => notImplemented('HomeSystemsService', 'listHomes'),
    createHome: () => notImplemented('HomeSystemsService', 'createHome'),
    updateHome: () => notImplemented('HomeSystemsService', 'updateHome'),
    deleteHome: () => notImplemented('HomeSystemsService', 'deleteHome'),
    listSystems: () => notImplemented('HomeSystemsService', 'listSystems'),
    getSystem: () => notImplemented('HomeSystemsService', 'getSystem'),
    getSystemState: () => notImplemented('HomeSystemsService', 'getSystemState'),
    sendCommand: () => notImplemented('HomeSystemsService', 'sendCommand'),
    getHistory: () => notImplemented('HomeSystemsService', 'getHistory'),
    getEvents: () => notImplemented('HomeSystemsService', 'getEvents'),
    getHardware: () => notImplemented('HomeSystemsService', 'getHardware'),
    updateHardware: () => notImplemented('HomeSystemsService', 'updateHardware'),
    listHardwareRegister: () => notImplemented('HomeSystemsService', 'listHardwareRegister'),
  }
}
