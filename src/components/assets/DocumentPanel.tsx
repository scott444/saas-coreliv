import { useEffect, useState, type FormEvent } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import type { DocumentInput, DocumentKind, HomeDocument } from '@/domain'
import { DOCUMENT_KINDS, DOCUMENT_KIND_LABELS } from '@/domain'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/states'
import { formatDateOnly } from '@/lib/format'
import { errorMessage } from '@/lib/errorMessage'

interface DocumentPanelProps {
  documents: HomeDocument[]
  canEdit: boolean
  onAdd(input: DocumentInput): void
  onDelete(documentId: string): void
  pending?: boolean
  error?: unknown
}

export function DocumentPanel({
  documents,
  canEdit,
  onAdd,
  onDelete,
  pending,
  error,
}: DocumentPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Documents</CardTitle>
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus /> Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState
            title="No documents"
            description="Receipts, manuals, permits, a photo of the data plate — the things you cannot reconstruct later."
            action={canEdit ? <Button size="sm" onClick={() => setOpen(true)}>Add a document</Button> : undefined}
          />
        ) : (
          <ul className="divide-y">
            {documents.map((document) => (
              <li key={document.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={document.storageUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {document.title}
                    </a>
                    <ExternalLink className="size-3 text-muted-foreground" />
                    <Badge variant="outline">{DOCUMENT_KIND_LABELS[document.kind]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {document.capturedOn ? formatDateOnly(document.capturedOn) : 'no date'}
                    {document.assetName ? ` · ${document.assetName}` : ''}
                    {document.notes ? ` · ${document.notes}` : ''}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${document.title}`}
                    onClick={() => onDelete(document.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DocumentDialog
        open={open}
        onOpenChange={setOpen}
        pending={pending}
        error={error}
        onSubmit={(input) => {
          onAdd(input)
          setOpen(false)
        }}
      />
    </Card>
  )
}

function DocumentDialog({
  open,
  onOpenChange,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  pending?: boolean
  error?: unknown
  onSubmit(input: DocumentInput): void
}) {
  const [kind, setKind] = useState<DocumentKind>('receipt')
  const [title, setTitle] = useState('')
  const [storageUrl, setStorageUrl] = useState('')
  const [capturedOn, setCapturedOn] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setKind('receipt')
    setTitle('')
    setStorageUrl('')
    setCapturedOn('')
    setNotes('')
  }, [open])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      // The asset is filled in by the caller; this dialog only ever opens
      // from an asset page.
      assetId: null,
      warrantyId: null,
      serviceEventId: null,
      kind,
      title: title.trim(),
      storageUrl: storageUrl.trim(),
      mimeType: null,
      capturedOn: capturedOn || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a document</DialogTitle>
            <DialogDescription>
              A link to where the file lives — cloud drive, manufacturer site, or a path into your
              own storage. Uploads are not wired up yet.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error, 'Could not save the document')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="document-title">Title</Label>
            <Input
              id="document-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="Carrier 59TP6 installation manual"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document-kind">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as DocumentKind)}>
                <SelectTrigger id="document-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {DOCUMENT_KIND_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-date">Dated</Label>
              <Input
                id="document-date"
                type="date"
                value={capturedOn}
                onChange={(e) => setCapturedOn(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-url">Link</Label>
            <Input
              id="document-url"
              value={storageUrl}
              onChange={(e) => setStorageUrl(e.target.value)}
              required
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-notes">Notes</Label>
            <Textarea
              id="document-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!title.trim() || !storageUrl.trim()}>
              Add document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
