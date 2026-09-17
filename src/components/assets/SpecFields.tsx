import type { SpecField, Specs, SpecValue } from '@/domain'
import { humanizeOption } from '@/domain'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Radix rejects an empty string as a value, so "not set" needs a sentinel. */
const UNSET = '__unset__'

/**
 * Renders a category's spec form from its `specSchema`.
 *
 * The taxonomy ships the field list, so adding a category - or a field to one -
 * is a migration, not a component change. Nothing here knows what a furnace is.
 */
export function SpecFields({
  schema,
  value,
  onChange,
  idPrefix = 'spec',
}: {
  schema: SpecField[]
  value: Specs
  onChange: (specs: Specs) => void
  idPrefix?: string
}) {
  if (schema.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This category has no specific fields. Anything worth noting can go in the notes.
      </p>
    )
  }

  const set = (key: string, next: SpecValue) => {
    const specs = { ...value }
    // Drop the key entirely rather than storing null, so `specs` only ever
    // holds what was actually filled in.
    if (next === null || next === '') delete specs[key]
    else specs[key] = next
    onChange(specs)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {schema.map((field) => {
        const id = `${idPrefix}-${field.key}`
        const current = value[field.key]

        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={id}>
              {field.label}
              {field.unit ? (
                <span className="ml-1 font-normal text-muted-foreground">({field.unit})</span>
              ) : null}
            </Label>

            {field.type === 'boolean' ? (
              <div className="flex h-9 items-center">
                <Switch
                  id={id}
                  checked={current === true}
                  onCheckedChange={(checked) => set(field.key, checked)}
                />
              </div>
            ) : field.type === 'select' ? (
              <Select
                value={typeof current === 'string' && current ? current : UNSET}
                onValueChange={(next) => set(field.key, next === UNSET ? null : next)}
              >
                <SelectTrigger id={id}>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Not set</SelectItem>
                  {(field.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {humanizeOption(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === 'number' ? (
              <Input
                id={id}
                type="number"
                step="any"
                value={typeof current === 'number' ? String(current) : ''}
                onChange={(event) => {
                  const raw = event.target.value
                  set(field.key, raw === '' ? null : Number(raw))
                }}
              />
            ) : (
              <Input
                id={id}
                value={typeof current === 'string' ? current : ''}
                onChange={(event) => set(field.key, event.target.value)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Read-only rendering of the same schema, for the asset page. */
export function SpecList({ schema, value }: { schema: SpecField[]; value: Specs }) {
  const filled = schema.filter((field) => {
    const v = value[field.key]
    return v !== undefined && v !== null && v !== ''
  })

  // Anything stored under a key the category no longer declares still gets
  // shown - losing data silently because a schema changed is worse than an
  // unlabelled row.
  const declared = new Set(schema.map((f) => f.key))
  const extras = Object.keys(value).filter((key) => !declared.has(key))

  if (filled.length === 0 && extras.length === 0) {
    return <p className="text-sm text-muted-foreground">No specifications recorded.</p>
  }

  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {filled.map((field) => (
        <div key={field.key}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</dt>
          <dd className="text-sm">{formatSpec(field, value[field.key] ?? null)}</dd>
        </div>
      ))}
      {extras.map((key) => (
        <div key={key}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {humanizeOption(key)}
          </dt>
          <dd className="text-sm">{String(value[key])}</dd>
        </div>
      ))}
    </dl>
  )
}

function formatSpec(field: SpecField, value: SpecValue): string {
  if (value === null || value === '') return '—'
  if (field.type === 'boolean') return value ? 'Yes' : 'No'
  const text = typeof value === 'string' ? humanizeOption(value) : String(value)
  return field.unit ? `${text} ${field.unit}` : text
}
