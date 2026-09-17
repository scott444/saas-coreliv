import type {
  AccessPoint,
  AccessPointInput,
  Asset,
  AssetDetail,
  AssetFilter,
  AssetInput,
  AssetListEntry,
  AuthSession,
  Category,
  CompleteDueInput,
  Consumable,
  ConsumableInput,
  DocumentInput,
  DueItem,
  HomeDocument,
  IrrigationZone,
  IrrigationZoneInput,
  Location,
  LocationInput,
  MaintenanceTask,
  MaintenanceTaskInput,
  Member,
  Organization,
  Plan,
  Property,
  PropertyInput,
  RedirectTarget,
  ReplacementPlan,
  Role,
  ServiceEvent,
  ServiceEventInput,
  Subscription,
  User,
  Vendor,
  VendorInput,
  Warranty,
  WarrantyInput,
} from '@/domain'

export interface AuthService {
  login(email: string, password: string): Promise<AuthSession>
  register(name: string, email: string, password: string): Promise<AuthSession>
  logout(): Promise<void>
  getCurrentUser(): Promise<User | null>
  refresh(): Promise<AuthSession>
}

export interface OrganizationService {
  list(): Promise<Organization[]>
  get(orgId: string): Promise<Organization>
  members(orgId: string): Promise<Member[]>
  invite(orgId: string, email: string, role: Role): Promise<Member>
  changeRole(orgId: string, userId: string, role: Role): Promise<Member>
  removeMember(orgId: string, userId: string): Promise<void>
}

export interface BillingService {
  getSubscription(orgId: string): Promise<Subscription>
  getPlans(): Promise<Plan[]>
  startCheckout(orgId: string, planId: string): Promise<RedirectTarget>
  openPortal(orgId: string): Promise<RedirectTarget>
  cancel(orgId: string): Promise<Subscription>
}

export interface PropertiesService {
  list(orgId: string): Promise<Property[]>
  create(orgId: string, input: PropertyInput): Promise<Property>
  update(propertyId: string, input: PropertyInput): Promise<Property>
  remove(propertyId: string): Promise<void>

  listLocations(propertyId: string): Promise<Location[]>
  createLocation(propertyId: string, input: LocationInput): Promise<Location>
  updateLocation(locationId: string, input: LocationInput): Promise<Location>
  removeLocation(locationId: string): Promise<void>

  listAccessPoints(propertyId: string): Promise<AccessPoint[]>
  createAccessPoint(propertyId: string, input: AccessPointInput): Promise<AccessPoint>
  updateAccessPoint(accessPointId: string, input: AccessPointInput): Promise<AccessPoint>
  removeAccessPoint(accessPointId: string): Promise<void>
}

export interface AssetsService {
  /** The register: every asset in the org, joined with its labels and warranty state. */
  list(orgId: string, filter?: AssetFilter): Promise<AssetListEntry[]>
  /** Everything the asset page shows, in one request. */
  get(assetId: string): Promise<AssetDetail>
  create(propertyId: string, input: AssetInput): Promise<Asset>
  update(assetId: string, input: AssetInput): Promise<Asset>
  remove(assetId: string): Promise<void>
  /** Global taxonomy; safe to cache for the session. */
  categories(): Promise<Category[]>
  replacementPlan(orgId: string): Promise<Array<ReplacementPlan & { assetId: string; assetName: string; propertyName: string }>>

  addWarranty(assetId: string, input: WarrantyInput): Promise<Warranty>
  updateWarranty(warrantyId: string, input: WarrantyInput): Promise<Warranty>
  removeWarranty(warrantyId: string): Promise<void>

  addConsumable(assetId: string, input: ConsumableInput): Promise<Consumable>
  updateConsumable(consumableId: string, input: ConsumableInput): Promise<Consumable>
  removeConsumable(consumableId: string): Promise<void>

  addEvent(assetId: string, input: ServiceEventInput): Promise<ServiceEvent>
  removeEvent(eventId: string): Promise<void>

  addDocument(propertyId: string, input: DocumentInput): Promise<HomeDocument>
  removeDocument(documentId: string): Promise<void>

  listZones(assetId: string): Promise<IrrigationZone[]>
  saveZone(assetId: string, input: IrrigationZoneInput, zoneId?: string): Promise<IrrigationZone>
  removeZone(zoneId: string): Promise<void>
}

export interface MaintenanceService {
  listTasks(orgId: string): Promise<MaintenanceTask[]>
  createTask(propertyId: string, input: MaintenanceTaskInput): Promise<MaintenanceTask>
  updateTask(taskId: string, input: MaintenanceTaskInput): Promise<MaintenanceTask>
  removeTask(taskId: string): Promise<void>
  /** Consumables and tasks unioned, including the ones never done yet. */
  due(orgId: string): Promise<DueItem[]>
  /**
   * Marks a task or consumable done. Advances its last-done date and appends a
   * service event, so completing something always leaves an audit trail.
   */
  complete(itemType: 'task' | 'consumable', itemId: string, input: CompleteDueInput): Promise<void>
}

export interface VendorsService {
  list(orgId: string): Promise<Vendor[]>
  create(orgId: string, input: VendorInput): Promise<Vendor>
  update(vendorId: string, input: VendorInput): Promise<Vendor>
  remove(vendorId: string): Promise<void>
}

export interface DocumentsService {
  list(orgId: string): Promise<HomeDocument[]>
}

export interface Services {
  auth: AuthService
  organizations: OrganizationService
  billing: BillingService
  properties: PropertiesService
  assets: AssetsService
  maintenance: MaintenanceService
  vendors: VendorsService
  documents: DocumentsService
}

export type DataMode = 'mock' | 'http'
