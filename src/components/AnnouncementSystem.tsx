import { useState } from 'react'
import { Megaphone, Pin, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Async, Page, PageHeader } from '@/components/ops'
import { useDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  pick,
  queryKeys,
  useAnnouncements,
  useRealtimeTable,
  useSaveAnnouncement,
} from '@/lib/queries'
import type {
  AnnouncementRow,
  AnnouncementSeverity,
  Audience,
  Locale,
  LocalisedText,
} from '@/lib/database.types'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

/**
 * Compose into, and read from, the `announcements` table.
 *
 * `title` and `body` are jsonb keyed {en,ja,id}, not strings: the notification
 * fan-out must not freeze one language at write time, because the recipient's
 * locale is theirs to change afterwards. The composer therefore writes all three
 * and `pick()` renders one.
 *
 * The metrics, social-media and template surfaces are gone — outside the scope
 * fence — and so is the placeholder string that stood in for a chart there.
 * What is left is the thing an organizer actually needs at 07:40 on day one.
 */
export default function AnnouncementSystem() {
  const { t, i18n } = useTranslation(['organizer', 'common'])
  const { eventId } = useParams()
  const dateTime = useDateTime()
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null)

  const feed = useAnnouncements(eventId)
  useRealtimeTable('announcements', queryKeys.announcements.list(eventId ?? '', {}), { eventId })

  return (
    <Page className="max-w-4xl">
      <PageHeader
        title={t('announcement.title')}
        description={t('announcement.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden="true" />
            {t('announcement.compose')}
          </Button>
        }
      />

      <div className="mt-6">
        <Async
          state={feed}
          icon={Megaphone}
          emptyTitle={t('announcement.empty')}
          emptyDescription={t('announcement.emptyBody')}
          emptyAction={<Button onClick={() => setEditing('new')}>{t('announcement.compose')}</Button>}
        >
          <ul className="space-y-3">
            {feed.data.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-medium text-card-foreground text-pretty">
                    {row.pinned && (
                      <Pin
                        className="mr-1 inline size-3.5 text-muted-foreground"
                        aria-label={t('announcement.pinned')}
                      />
                    )}
                    {pick(row.title, i18n.language)}
                  </h2>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Badge variant={SEVERITY_VARIANT[row.severity]}>
                      {t(`announcement.severity.${row.severity}`)}
                    </Badge>
                    <Badge variant={row.status === 'published' ? 'success' : 'outline'}>
                      {t(`announcement.status.${row.status}`)}
                    </Badge>
                  </div>
                </div>

                <p className="mt-1 text-sm text-muted-foreground text-pretty">
                  {pick(row.body, i18n.language)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {row.audience.map((audience) => (
                    <Badge key={audience} variant="outline">
                      {t(`announcement.audienceOption.${audience}`)}
                    </Badge>
                  ))}
                  <span className="tabular-nums">
                    {row.publish_at ? dateTime(row.publish_at) : t('announcement.notScheduled')}
                  </span>
                  <span className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                    {t('common:action.edit')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Async>
      </div>

      {editing && (
        <Composer
          eventId={eventId}
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  )
}

// ---------------------------------------------------------------------------

const SEVERITY_VARIANT: Record<AnnouncementSeverity, 'info' | 'warning' | 'danger'> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
}

const LOCALES: Locale[] = ['en', 'ja', 'id']
const SEVERITIES: AnnouncementSeverity[] = ['info', 'warning', 'critical']
const AUDIENCES: Audience[] = ['public', 'attendee', 'circle', 'staff']

function Composer({
  eventId,
  row,
  onClose,
}: {
  eventId: string | undefined
  row: AnnouncementRow | null
  onClose: () => void
}) {
  const { t } = useTranslation(['organizer', 'common'])
  const userId = useAuthStore((s) => s.user?.id)
  const save = useSaveAnnouncement(eventId ?? '')

  const [title, setTitle] = useState<LocalisedText>(row?.title ?? {})
  const [body, setBody] = useState<LocalisedText>(row?.body ?? {})
  const [severity, setSeverity] = useState<AnnouncementSeverity>(row?.severity ?? 'info')
  const [audience, setAudience] = useState<Audience[]>(row?.audience ?? ['public'])
  const [pinned, setPinned] = useState(row?.pinned ?? false)

  // English is the i18next fallback, so an announcement without it renders as an
  // empty card for every reader whose locale was not filled in.
  const valid = Boolean(title.en?.trim() && body.en?.trim() && audience.length > 0)

  const submit = (status: 'draft' | 'published') => {
    save.mutate(
      {
        ...(row ? { id: row.id } : {}),
        title,
        body,
        severity,
        audience,
        pinned,
        status,
        publish_at: status === 'published' ? (row?.publish_at ?? new Date().toISOString()) : null,
        created_by: row?.created_by ?? userId ?? null,
      },
      {
        onSuccess: () => {
          toast.success(status === 'published' ? t('announcement.publishedOk') : t('common:status.saved'))
          onClose()
        },
        onError: () => toast.error(t('common:error.generic')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row ? t('common:action.edit') : t('announcement.compose')}</DialogTitle>
          <DialogDescription>{t('announcement.composeHint')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="en" className="mt-4">
          <TabsList>
            {LOCALES.map((locale) => (
              <TabsTrigger key={locale} value={locale} className="coarse:min-h-11">
                {t(`common:language.${locale}`)}
                {locale === 'en' && <span aria-hidden="true"> *</span>}
              </TabsTrigger>
            ))}
          </TabsList>

          {LOCALES.map((locale) => (
            <TabsContent key={locale} value={locale} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={`title-${locale}`}>{t('announcement.subject')}</Label>
                <Input
                  id={`title-${locale}`}
                  lang={locale}
                  value={title[locale] ?? ''}
                  aria-invalid={locale === 'en' && !title.en?.trim()}
                  onChange={(e) => setTitle({ ...title, [locale]: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`body-${locale}`}>{t('announcement.body')}</Label>
                <Textarea
                  id={`body-${locale}`}
                  lang={locale}
                  rows={5}
                  value={body[locale] ?? ''}
                  aria-invalid={locale === 'en' && !body.en?.trim()}
                  onChange={(e) => setBody({ ...body, [locale]: e.target.value })}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="severity">{t('announcement.severityLabel')}</Label>
            <Select
              value={severity}
              onValueChange={(value) => setSeverity(value as AnnouncementSeverity)}
            >
              <SelectTrigger id="severity" className="coarse:min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`announcement.severity.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <Label htmlFor="pinned">{t('announcement.pin')}</Label>
            <Switch id="pinned" checked={pinned} onCheckedChange={setPinned} />
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-foreground">
            {t('announcement.audience')}
          </legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {AUDIENCES.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm coarse:min-h-11">
                <Checkbox
                  aria-label={t(`announcement.audienceOption.${value}`)}
                  checked={audience.includes(value)}
                  onCheckedChange={(checked) =>
                    setAudience(
                      checked ? [...audience, value] : audience.filter((a) => a !== value),
                    )
                  }
                />
                {t(`announcement.audienceOption.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>

        {!valid && (
          <p className={cn('mt-3 text-sm text-destructive')} role="alert">
            {t('announcement.required')}
          </p>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            {t('common:action.cancel')}
          </Button>
          <Button
            variant="outline"
            disabled={!valid || save.isPending}
            onClick={() => submit('draft')}
          >
            {t('common:action.saveDraft')}
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => submit('published')}>
            {t('announcement.publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
