import type {
  AccessPoint,
  Asset,
  AssetDetail,
  AssetInput,
  AssetListEntry,
  AuthSession,
  Category,
  Consumable,
  DueItem,
  HomeDocument,
  IrrigationZone,
  Location,
  MaintenanceTask,
  Member,
  Organization,
  Plan,
  Property,
  ServiceEvent,
  Subscription,
  User,
  Vendor,
  Warranty,
} from '@/domain'
import { addInterval, bestWarranty, daysFromToday, dueStatus, todayDateOnly } from '@/domain'
import type { Services } from '@/services'
import { ServiceError } from '@/services'

/**
 * A hand-written, in-memory implementation of every service interface.
 *
 * This exists to keep the boundary honest: `serviceBoundary.test.tsx` renders
 * the app against it with `fetch` disabled, so anything that reached past the
 * interfaces to a URL, a header or the shape of a REST response fails there
 * rather than in production. It is deliberately *not* a second copy of the
 * API - it holds just enough to render, and it is written independently of
 * `src/services/http` so the two cannot drift together.
 */

const today = todayDateOnly()
const day = (offset: number) => addInterval(today, offset, 'day') ?? today
const year = (offset: number) => addInterval(today, offset, 'year') ?? today

export interface FakeOverrides {
  properties?: Property[]
  assets?: AssetListEntry[]
  due?: DueItem[]
  vendors?: Vendor[]
  documents?: HomeDocument[]
  tasks?: MaintenanceTask[]
  subscription?: Subscription
  /** Every method rejects with this instead of answering. */
  failWith?: ServiceError
}

export const FAKE_USER: User = { id: 'u-1', name: 'Dana Reyes', email: 'dana@example.com' }

export const FAKE_ORG: Organization = {
  id: 'org-1',
  name: 'The Reyes household',
  role: 'Owner',
  memberCount: 2,
  propertyCount: 1,
}

export const FAKE_PROPERTY: Property = {
  id: 'prop-1',
  name: 'Maple Street',
  address: '418 Maple Street',
  yearBuilt: 1998,
  purchaseDate: year(-6),
  notes: null,
  createdAt: new Date().toISOString(),
  assetCount: 2,
  openItemCount: 1,
}

const FURNACE_WARRANTY: Warranty = {
  id: 'w-1',
  assetId: 'asset-1',
  kind: 'manufacturer_parts',
  providerId: null,
  providerName: 'Carrier',
  startDate: year(-5),
  endDate: day(30),
  registered: true,
  registrationRef: 'CAR-1',
  transferable: false,
  coverageNotes: 'Heat exchanger 20 years.',
  claimPhone: null,
}

const FURNACE: Asset = {
  id: 'asset-1',
  propertyId: 'prop-1',
  categoryId: 'cat-furnace',
  locationId: null,
  parentAssetId: null,
  name: 'Furnace',
  brand: 'Carrier',
  modelNumber: '59TP6B080V17-20',
  serialNumber: '4218A93472',
  description: null,
  purchaseDate: year(-5),
  installDate: year(-5),
  manufactureDate: null,
  purchaseCost: 3180,
  installCost: 1420,
  retailerId: null,
  installerId: null,
  expectedLifespanYears: 20,
  status: 'active',
  replacedById: null,
  retiredAt: null,
  specs: { fuel: 'natural_gas', afue: 96 },
  notes: null,
  tags: ['gas'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const WATER_HEATER: Asset = {
  ...FURNACE,
  id: 'asset-2',
  name: 'Water heater',
  brand: 'Rheem',
  modelNumber: 'XG50T06EC38U0',
  serialNumber: 'RH2178-40912',
  status: 'needs_repair',
  installDate: year(-9),
  expectedLifespanYears: 10,
  specs: { type: 'tank', capacity_gal: 50 },
  tags: ['replace-soon'],
}

function entry(asset: Asset, warranties: Warranty[], overrides: Partial<AssetListEntry> = {}): AssetListEntry {
  return {
    id: asset.id,
    propertyId: asset.propertyId,
    propertyName: FAKE_PROPERTY.name,
    name: asset.name,
    brand: asset.brand,
    modelNumber: asset.modelNumber,
    serialNumber: asset.serialNumber,
    categoryId: asset.categoryId,
    categoryName: asset.id === 'asset-1' ? 'Furnace' : 'Water heater',
    categorySlug: asset.id === 'asset-1' ? 'furnace' : 'water-heater',
    groupName: asset.id === 'asset-1' ? 'HVAC' : 'Water',
    locationName: 'Mechanical room',
    status: asset.status,
    installDate: asset.installDate,
    purchaseDate: asset.purchaseDate,
    expectedLifespanYears: asset.expectedLifespanYears,
    warranty: bestWarranty(warranties),
    lastServicedOn: null,
    openItemCount: 0,
    documentCount: 0,
    tags: asset.tags,
    ...overrides,
  }
}

const FAKE_DUE: DueItem[] = [
  {
    itemType: 'consumable',
    id: 'cons-1',
    propertyId: 'prop-1',
    propertyName: FAKE_PROPERTY.name,
    assetId: 'asset-1',
    assetName: 'Furnace',
    itemName: 'Air filter',
    dueOn: day(-30),
    lastDoneOn: day(-120),
    intervalValue: 3,
    intervalUnit: 'month',
    diy: true,
    status: dueStatus(day(-30)),
    daysUntilDue: daysFromToday(day(-30)),
  },
  {
    itemType: 'task',
    id: 'task-1',
    propertyId: 'prop-1',
    propertyName: FAKE_PROPERTY.name,
    assetId: 'asset-2',
    assetName: 'Water heater',
    itemName: 'Flush water heater',
    dueOn: null,
    lastDoneOn: null,
    intervalValue: 1,
    intervalUnit: 'year',
    diy: true,
    status: 'unscheduled',
    daysUntilDue: null,
  },
]

const FAKE_CATEGORIES: Category[] = [
  { id: 'cat-hvac', parentId: null, name: 'HVAC', slug: 'hvac', specSchema: [], sortOrder: 10 },
  {
    id: 'cat-furnace',
    parentId: 'cat-hvac',
    name: 'Furnace',
    slug: 'furnace',
    specSchema: [
      { key: 'fuel', label: 'Fuel', type: 'select', options: ['natural_gas', 'electric'] },
      { key: 'afue', label: 'AFUE', type: 'number', unit: '%' },
    ],
    sortOrder: 10,
  },
]

const FAKE_PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', priceMonthly: 0, features: ['One property'], assetLimit: 25 },
  { id: 'home', name: 'Home', priceMonthly: 12, features: ['Up to 3 properties'], assetLimit: null },
]

const FAKE_MEMBERS: Member[] = [
  { ...FAKE_USER, role: 'Owner', joinedAt: new Date().toISOString(), status: 'Active' },
  {
    id: 'u-2',
    name: 'Sam Okafor',
    email: 'sam@example.com',
    role: 'Admin',
    joinedAt: new Date().toISOString(),
    status: 'Active',
  },
]

export function createFakeServices(overrides: FakeOverrides = {}): Services {
  const fail = <T>(): Promise<T> =>
    overrides.failWith ? Promise.reject(overrides.failWith) : Promise.resolve(undefined as T)

  const guard = <T>(value: T): Promise<T> =>
    overrides.failWith ? Promise.reject(overrides.failWith) : Promise.resolve(value)

  const properties = overrides.properties ?? [FAKE_PROPERTY]
  const assets = overrides.assets ?? [
    entry(FURNACE, [FURNACE_WARRANTY], { openItemCount: 1 }),
    entry(WATER_HEATER, []),
  ]
  const vendors = overrides.vendors ?? []
  const documents = overrides.documents ?? []
  const tasks = overrides.tasks ?? []
  const due = overrides.due ?? FAKE_DUE

  const session: AuthSession = {
    user: FAKE_USER,
    accessToken: 'fake-token',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  }

  const detail: AssetDetail = {
    asset: FURNACE,
    property: { id: FAKE_PROPERTY.id, name: FAKE_PROPERTY.name },
    category: FAKE_CATEGORIES[1] ?? null,
    groupName: 'HVAC',
    location: null,
    parent: null,
    children: [],
    retailer: null,
    installer: null,
    replacedBy: null,
    warranties: [FURNACE_WARRANTY],
    consumables: [] as Consumable[],
    tasks: [] as MaintenanceTask[],
    events: [] as ServiceEvent[],
    documents: [] as HomeDocument[],
    irrigationZones: [] as IrrigationZone[],
    replacement: {
      inServiceDate: FURNACE.installDate,
      ageYears: 5,
      expectedLifespanYears: 20,
      projectedReplacement: year(15),
      acquisitionCost: 4600,
      lifetimeServiceCost: 0,
    },
  }

  return {
    auth: {
      login: () => guard(session),
      register: () => guard(session),
      logout: () => guard(undefined),
      getCurrentUser: () => guard<User | null>(FAKE_USER),
      refresh: () => guard(session),
    },

    organizations: {
      list: () => guard([FAKE_ORG]),
      get: () => guard(FAKE_ORG),
      members: () => guard(FAKE_MEMBERS),
      invite: (_orgId, email, role) =>
        guard<Member>({
          id: 'u-new',
          name: email.split('@')[0] ?? email,
          email,
          role,
          joinedAt: new Date().toISOString(),
          status: 'Invited',
        }),
      changeRole: (_orgId, userId, role) => {
        const member = FAKE_MEMBERS.find((m) => m.id === userId)
        if (!member) return fail<Member>()
        return guard({ ...member, role })
      },
      removeMember: () => guard(undefined),
    },

    billing: {
      getSubscription: () =>
        guard(
          overrides.subscription ?? {
            planId: 'home',
            status: 'Active',
            currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          },
        ),
      getPlans: () => guard(FAKE_PLANS),
      startCheckout: () => guard({ url: '/billing/return?status=success' }),
      openPortal: () => guard({ url: '/billing/return?status=portal' }),
      cancel: () =>
        guard<Subscription>({
          planId: 'starter',
          status: 'Canceled',
          currentPeriodEnd: new Date().toISOString(),
        }),
    },

    properties: {
      list: () => guard(properties),
      create: (_orgId, input) => guard<Property>({ ...FAKE_PROPERTY, ...input, id: 'prop-new' }),
      update: (propertyId, input) => guard<Property>({ ...FAKE_PROPERTY, ...input, id: propertyId }),
      remove: () => guard(undefined),
      listLocations: () => guard([] as Location[]),
      createLocation: (propertyId, input) =>
        guard<Location>({ id: 'loc-new', propertyId, assetCount: 0, ...input }),
      updateLocation: (locationId, input) =>
        guard<Location>({ id: locationId, propertyId: 'prop-1', assetCount: 0, ...input }),
      removeLocation: () => guard(undefined),
      listAccessPoints: () => guard([] as AccessPoint[]),
      createAccessPoint: (propertyId, input) =>
        guard<AccessPoint>({ id: 'ap-new', propertyId, assetName: null, locationName: null, ...input }),
      updateAccessPoint: (accessPointId, input) =>
        guard<AccessPoint>({
          id: accessPointId,
          propertyId: 'prop-1',
          assetName: null,
          locationName: null,
          ...input,
        }),
      removeAccessPoint: () => guard(undefined),
    },

    assets: {
      list: () => guard(assets),
      get: () => guard(detail),
      create: (propertyId, input: AssetInput) =>
        guard<Asset>({
          ...FURNACE,
          ...input,
          id: 'asset-new',
          propertyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      update: (assetId, input) => guard<Asset>({ ...FURNACE, ...input, id: assetId }),
      remove: () => guard(undefined),
      categories: () => guard(FAKE_CATEGORIES),
      replacementPlan: () => guard([]),

      addWarranty: (assetId, input) => guard<Warranty>({ ...FURNACE_WARRANTY, ...input, assetId }),
      updateWarranty: (warrantyId, input) =>
        guard<Warranty>({ ...FURNACE_WARRANTY, ...input, id: warrantyId }),
      removeWarranty: () => guard(undefined),

      addConsumable: (assetId, input) => guard<Consumable>({ id: 'cons-new', assetId, ...input }),
      updateConsumable: (consumableId, input) =>
        guard<Consumable>({ id: consumableId, assetId: 'asset-1', ...input }),
      removeConsumable: () => guard(undefined),

      addEvent: (assetId, input) =>
        guard<ServiceEvent>({
          id: 'event-new',
          assetId,
          assetName: 'Furnace',
          propertyId: 'prop-1',
          vendorName: null,
          createdAt: new Date().toISOString(),
          ...input,
        }),
      removeEvent: () => guard(undefined),

      addDocument: (propertyId, input) =>
        guard<HomeDocument>({
          id: 'doc-new',
          propertyId,
          assetName: null,
          byteSize: null,
          createdAt: new Date().toISOString(),
          ...input,
        }),
      removeDocument: () => guard(undefined),

      listZones: () => guard([] as IrrigationZone[]),
      saveZone: (assetId, input) =>
        guard<IrrigationZone>({ id: 'zone-new', controllerAssetId: assetId, ...input }),
      removeZone: () => guard(undefined),
    },

    maintenance: {
      listTasks: () => guard(tasks),
      createTask: (propertyId, input) =>
        guard<MaintenanceTask>({
          id: 'task-new',
          propertyId,
          propertyName: FAKE_PROPERTY.name,
          assetName: null,
          preferredVendorName: null,
          ...input,
        }),
      updateTask: (taskId, input) =>
        guard<MaintenanceTask>({
          id: taskId,
          propertyId: 'prop-1',
          propertyName: FAKE_PROPERTY.name,
          assetName: null,
          preferredVendorName: null,
          ...input,
        }),
      removeTask: () => guard(undefined),
      due: () => guard(due),
      complete: () => guard(undefined),
    },

    vendors: {
      list: () => guard(vendors),
      create: (_orgId, input) => guard<Vendor>({ id: 'vendor-new', useCount: 0, ...input }),
      update: (vendorId, input) => guard<Vendor>({ id: vendorId, useCount: 0, ...input }),
      remove: () => guard(undefined),
    },

    documents: {
      list: () => guard(documents),
    },
  }
}
