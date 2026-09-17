import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Search } from 'lucide-react'
import { DOCUMENT_KIND_LABELS, type DocumentKind } from '@/domain'
import { useCurrentOrgId } from '@/app/OrgProvider'
import { useDocuments } from '@/hooks/useVendors'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateOnly } from '@/lib/format'

const ALL = '__all__'

export function DocumentsPage() {
  const orgId = useCurrentOrgId()
  const documents = useDocuments(orgId)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<string>(ALL)

  const all = useMemo(() => documents.data ?? [], [documents.data])

  // Only the kinds actually present, so the filter reflects this house.
  const kinds = useMemo(() => {
    const seen = new Set<DocumentKind>()
    for (const document of all) seen.add(document.kind)
    return [...seen].sort()
  }, [all])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return all.filter((document) => {
      if (kind !== ALL && document.kind !== kind) return false
      if (!needle) return true
      return [document.title, document.assetName, document.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [all, kind, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Receipts, manuals, permits and photos, across every property."
      />

      {documents.isPending ? (
        <LoadingState variant="list" />
      ) : documents.error ? (
        <ErrorState
          error={documents.error}
          title="Could not load your documents"
          onRetry={() => void documents.refetch()}
        />
      ) : all.length === 0 ? (
        <EmptyState
          title="Nothing filed yet"
          description="Documents are added from an asset, on its Documents tab — that is how they stay attached to the thing they describe."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search titles, assets, notes…"
                className="pl-9"
                aria-label="Search documents"
              />
            </div>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-48" aria-label="Filter by kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All kinds</SelectItem>
                {kinds.map((value) => (
                  <SelectItem key={value} value={value}>
                    {DOCUMENT_KIND_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visible.length === 0 ? (
            <EmptyState title="Nothing matches" description="Try a different search." />
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="hidden sm:table-cell">Kind</TableHead>
                    <TableHead className="hidden md:table-cell">Asset</TableHead>
                    <TableHead className="hidden lg:table-cell">Dated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <a
                          href={document.storageUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                        >
                          {document.title}
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </a>
                        {document.notes ? (
                          <p className="text-xs text-muted-foreground">{document.notes}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{DOCUMENT_KIND_LABELS[document.kind]}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {document.assetId && document.assetName ? (
                          <Link
                            to={`/assets/${document.assetId}`}
                            className="text-sm underline-offset-4 hover:underline"
                          >
                            {document.assetName}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">Property-level</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap lg:table-cell text-sm text-muted-foreground">
                        {document.capturedOn ? formatDateOnly(document.capturedOn) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
