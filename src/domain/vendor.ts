export type VendorRole = 'retailer' | 'installer' | 'service' | 'manufacturer' | 'inspector'

export const VENDOR_ROLES: readonly VendorRole[] = [
  'retailer',
  'installer',
  'service',
  'manufacturer',
  'inspector',
] as const

export interface Vendor {
  id: string
  name: string
  roles: VendorRole[]
  phone: string | null
  email: string | null
  website: string | null
  /** Your customer or account number with them. */
  accountNumber: string | null
  notes: string | null
  /** How many assets and service events point at them. */
  useCount: number
}

export interface VendorInput {
  name: string
  roles: VendorRole[]
  phone: string | null
  email: string | null
  website: string | null
  accountNumber: string | null
  notes: string | null
}
