/**
 * One field in a category's spec form. The taxonomy ships `spec_schema` as a
 * list of these, so a single form component renders the right inputs for a
 * furnace or a roof without the UI knowing either exists.
 */
export interface SpecField {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select'
  unit?: string
  options?: string[]
}

export interface Category {
  id: string
  parentId: string | null
  name: string
  slug: string
  specSchema: SpecField[]
  sortOrder: number
}

/** A leaf category with its group name, for grouped selects and labels. */
export interface CategoryOption extends Category {
  groupName: string | null
}

export type SpecValue = string | number | boolean | null
export type Specs = Record<string, SpecValue>

/** Renders a raw spec value using its field definition ("16 SEER2", "Yes"). */
export function formatSpecValue(field: SpecField, value: SpecValue): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field.type === 'boolean') return value ? 'Yes' : 'No'
  const text = typeof value === 'string' ? humanizeOption(value) : String(value)
  return field.unit ? `${text} ${field.unit}` : text
}

/** "natural_gas" -> "Natural gas". Enum-ish option values are stored as slugs. */
export function humanizeOption(value: string): string {
  if (!value) return value
  if (!/^[a-z0-9_]+$/.test(value)) return value
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
