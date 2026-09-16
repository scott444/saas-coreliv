import type { HardwareRegisterEntry, Home, HomeSystem, Reading, SystemEvent, SystemHardware, SystemState } from '@/domain'
import type { HomeSystemsService } from '../types'
import type { ApiClient } from '../apiClient'

export function createMockHomeSystemsService(client: ApiClient): HomeSystemsService {
  return {
    listHomes: (orgId) => client.get<Home[]>(`/orgs/${orgId}/homes`),
    createHome: (orgId, input) => client.post<Home>(`/orgs/${orgId}/homes`, input),
    updateHome: (homeId, input) => client.put<Home>(`/homes/${homeId}`, input),
    deleteHome: (homeId) => client.delete<void>(`/homes/${homeId}`),
    listSystems: (homeId) => client.get<HomeSystem[]>(`/homes/${homeId}/systems`),
    getSystem: (systemId) => client.get<HomeSystem>(`/systems/${systemId}`),
    getSystemState: (systemId) => client.get<SystemState>(`/systems/${systemId}/state`),
    sendCommand: (systemId, command) => client.post<SystemState>(`/systems/${systemId}/commands`, command),
    getHistory: (systemId, range = '24h') => client.get<Reading[]>(`/systems/${systemId}/history?range=${range}`),
    getEvents: (systemId) => client.get<SystemEvent[]>(`/systems/${systemId}/events`),
    getHardware: (systemId) => client.get<SystemHardware | null>(`/systems/${systemId}/hardware`),
    updateHardware: (systemId, input) => client.put<SystemHardware>(`/systems/${systemId}/hardware`, input),
    listHardwareRegister: (orgId) => client.get<HardwareRegisterEntry[]>(`/orgs/${orgId}/hardware`),
  }
}
