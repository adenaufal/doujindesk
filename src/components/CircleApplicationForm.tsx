import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, X } from 'lucide-react'
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  type FieldPath,
  type Resolver,
  useWatch,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import CircleStatus from '@/pages/CircleStatus'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import type { CircleRow, EventPricingRow, SpaceType } from '@/lib/database.types'
import { formatMoney } from '@/lib/money'
import { useCircles, useEvent, useList, useSaveCircle } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * The circle application form — the app's money-in front door.
 *
 * What was wrong before: the submit handler spread the whole zod object into
 * `circles`, and ~15 of those keys are not columns (`space_preference`,
 * `space_size`, `twitter`, `pixiv`, `website`, `currency`, …). PostgREST rejects
 * the whole INSERT with PGRST204, so no application has ever been filed. It also
 * never set `user_id`, which the RLS INSERT check `auth.uid() = user_id` requires,
 * and it minted a `circle_code` client-side — the organizer allocates A-01, and
 * 005 made the column nullable precisely so a draft has none.
 *
 * The payload is now mapped field-for-field. Never spread the form object into a
 * table again: the schema is the contract and `database.types.ts` enforces it.
 */

/** One save every 900 ms of quiet, not one per keystroke. */
const DRAFT_DEBOUNCE_MS = 900

/**
 * Kana, kanji and the CJK extension block. A circle name written in any of them
 * needs a reading, because kana sort order (五十音) cannot be derived from kanji
 * — see `kana_sort_key()` in 005. 'Studio Kelinci' needs nothing.
 *
 * ponytail: script detection by codepoint range, which cannot tell a Japanese
 * name from a Chinese one and does not care. Upgrade path if false positives
 * ever appear: `Intl.Segmenter` with a script property, or a proper detection
 * helper — both are heavier than the problem.
 */
const JAPANESE_SCRIPT = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/

const SPACE_TYPES: SpaceType[] = [
  'circle_space_1',
  'circle_space_2',
  'circle_space_4',
  'circle_booth_a',
  'circle_booth_b',
]

const SPACE_LABEL: Record<SpaceType, string> = {
  circle_space_1: '1 space (1×2 m)',
  circle_space_2: '2 spaces (2×2 m)',
  circle_space_4: '4 spaces (4×2 m)',
  circle_booth_a: 'Booth A (corner)',
  circle_booth_b: 'Booth B (double corner)',
}

const GENRES = [
  'Original',
  'Fanwork',
  'Illustration',
  'Novel',
  'Manga',
  'Music',
  'Game',
  'Cosplay',
  'Critique',
  'Other',
]

const PRODUCT_TYPES = [
  'doujinshi',
  'illustration',
  'novel',
  'music',
  'game',
  'goods',
  'accessory',
  'print',
]

const optionalText = z.string().trim().optional()
const optionalUrl = z.string().trim().url('Enter a full URL, including https://').or(z.literal('')).optional()

const schema = z
  .object({
    circle_name: z.string().trim().min(1).max(100),
    circle_name_furigana: optionalText,
    pen_name: z.string().trim().min(1),
    pen_name_furigana: optionalText,
    email: z.string().trim().email(),
    phone: optionalText,
    address: optionalText,
    postal_code: optionalText,
    country: optionalText,
    co_rep_name: optionalText,
    co_rep_email: z.string().trim().email().or(z.literal('')).optional(),
    co_rep_phone: optionalText,
    emergency_contact_name: optionalText,
    emergency_contact_phone: optionalText,
    social_media_website: optionalUrl,
    social_media_twitter: optionalText,
    social_media_pixiv: optionalText,
    social_media_instagram: optionalText,
    marketplace_link: optionalUrl,
    space_type: z.enum(SPACE_TYPES as [SpaceType, ...SpaceType[]]),
    additional_table: z.boolean(),
    additional_chair: z.boolean(),
    additional_power: z.boolean(),
    exhibitor_passes: z.coerce.number().int().min(1).max(4),
    fandom: optionalText,
    genre: z.string().trim().min(1),
    rating: z.enum(['all_ages', 'r15', 'r18']),
    product_types: z.array(z.string()).min(1),
    description: z.string().trim().min(1).max(2000),
    works_description: optionalText,
    previous_participation: z.boolean(),
    sells_commission: z.boolean(),
    special_requests: optionalText,
  })
  .superRefine((values, ctx) => {
    // Conditionally required, never globally: a DB CHECK would be too blunt and
    // would reject every Indonesian circle.
    for (const [name, reading] of [
      ['circle_name', 'circle_name_furigana'],
      ['pen_name', 'pen_name_furigana'],
    ] as const) {
      if (JAPANESE_SCRIPT.test(values[name]) && !values[reading]?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: [reading],
          message: 'Add the kana reading — it is what sorts and searches the catalog.',
        })
      }
    }
  })

export type CircleApplicationValues = z.infer<typeof schema>

const EMPTY: CircleApplicationValues = {
  circle_name: '',
  circle_name_furigana: '',
  pen_name: '',
  pen_name_furigana: '',
  email: '',
  phone: '',
  address: '',
  postal_code: '',
  country: '',
  co_rep_name: '',
  co_rep_email: '',
  co_rep_phone: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  social_media_website: '',
  social_media_twitter: '',
  social_media_pixiv: '',
  social_media_instagram: '',
  marketplace_link: '',
  space_type: 'circle_space_1',
  additional_table: false,
  additional_chair: false,
  additional_power: false,
  exhibitor_passes: 1,
  fandom: '',
  genre: '',
  rating: 'all_ages',
  product_types: [],
  description: '',
  works_description: '',
  previous_participation: false,
  sells_commission: false,
  special_requests: '',
}

interface CircleApplicationFormProps {
  eventId: string
  onSubmit?: (values: CircleApplicationValues) => void
}

export default function CircleApplicationForm({ eventId, onSubmit }: CircleApplicationFormProps) {
  const { t, i18n } = useTranslation(['circle', 'common'])
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? null

  const { data: circles, isLoading } = useCircles(eventId)
  const { data: event } = useEvent(eventId)
  const pricing = useEventPricing(eventId)
  const save = useSaveCircle(eventId)

  // RLS returns a circle owner only their own rows, so this filter is belt and
  // braces rather than access control. Newest first: 005's UNIQUE(event_id,
  // user_id) means there is at most one, but a fixture or a legacy row can lie.
  const mine = useMemo(() => {
    if (!userId) return null
    return (
      [...circles]
        .filter((c) => c.user_id === userId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null
    )
  }, [circles, userId])

  const draft = mine?.application_status === 'draft' ? mine : null

  const [cut, setCut] = useState<File | null>(null)
  const [samples, setSamples] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  const form = useForm<CircleApplicationValues>({
    // The cast is the zod-4 / @hookform/resolvers-5 seam: the resolver package
    // resolves its own copy of react-hook-form's types, so structurally
    // identical `Resolver`s are nominally unrelated to tsc.
    resolver: zodResolver(schema) as unknown as Resolver<CircleApplicationValues>,
    defaultValues: EMPTY,
  })

  const priced = useWatch({
    control: form.control,
    name: [
      'space_type',
      'additional_table',
      'additional_chair',
      'additional_power',
      'exhibitor_passes',
    ],
  })

  // Resume the draft once it arrives. `reset` with `keepDirtyValues` so a slow
  // query cannot wipe what the applicant already typed.
  const loadedRef = useRef(false)
  useEffect(() => {
    if (!draft || loadedRef.current) return
    loadedRef.current = true
    form.reset({ ...EMPTY, ...pickValues(draft) }, { keepDirtyValues: true })
  }, [draft, form])

  useEffect(() => {
    if (userId && user?.email && !form.getValues('email')) form.setValue('email', user.email)
  }, [userId, user?.email, form])

  const payload = useCallback(
    (status: 'draft' | 'submitted', extra: Record<string, unknown> = {}) => {
      const v = form.getValues()
      return {
        ...(mine ? { id: mine.id } : {}),
        user_id: userId,
        circle_name: v.circle_name,
        circle_name_furigana: v.circle_name_furigana || null,
        pen_name: v.pen_name,
        pen_name_furigana: v.pen_name_furigana || null,
        email: v.email,
        phone: v.phone || null,
        address: v.address || null,
        postal_code: v.postal_code || null,
        country: v.country || null,
        co_rep_name: v.co_rep_name || null,
        co_rep_email: v.co_rep_email || null,
        co_rep_phone: v.co_rep_phone || null,
        emergency_contact_name: v.emergency_contact_name || null,
        emergency_contact_phone: v.emergency_contact_phone || null,
        social_media_website: v.social_media_website || null,
        social_media_twitter: v.social_media_twitter || null,
        social_media_pixiv: v.social_media_pixiv || null,
        social_media_instagram: v.social_media_instagram || null,
        marketplace_link: v.marketplace_link || null,
        space_type: v.space_type,
        additional_table: v.additional_table,
        additional_chair: v.additional_chair,
        additional_power: v.additional_power,
        exhibitor_passes: v.exhibitor_passes,
        fandom: v.fandom || null,
        genre: v.genre || null,
        rating: v.rating,
        product_types: v.product_types,
        description: v.description || null,
        works_description: v.works_description || null,
        previous_participation: v.previous_participation,
        sells_commission: v.sells_commission,
        special_requests: v.special_requests || null,
        application_status: status,
        // Recomputed by `circles_set_total_amount` from `event_pricing` on both
        // INSERT and UPDATE; whatever goes up here is discarded. It is sent so
        // the row carries the quote the applicant agreed to until the trigger
        // prices it.
        total_amount: quote(pricing.data, form.getValues()),
        ...extra,
      }
    },
    [form, mine, userId, pricing.data],
  )

  // Save-as-draft: one debounced write to the same `circles` row, resumed by
  // (event_id, user_id). No drafts table — 005 added 'draft' to the CHECK and
  // the unique index that makes this a single row per applicant per event.
  const saveDraft = useCallback(async () => {
    if (!userId || busy) return
    if (!(form.getValues('circle_name') ?? '').trim()) return
    if (mine && mine.application_status !== 'draft') return
    try {
      const row = await save.mutateAsync(payload('draft'))
      if (!mine) loadedRef.current = true
      setDraftSavedAt(row.updated_at ?? new Date().toISOString())
    } catch {
      // A failed autosave is not worth a toast on every keystroke; the applicant
      // finds out at submit, which is a blocking write with its own error.
    }
  }, [busy, form, mine, payload, save, userId])

  const saveDraftRef = useRef(saveDraft)
  saveDraftRef.current = saveDraft

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const sub = form.watch(() => {
      clearTimeout(timer)
      timer = setTimeout(() => void saveDraftRef.current(), DRAFT_DEBOUNCE_MS)
    })
    return () => {
      clearTimeout(timer)
      sub.unsubscribe()
    }
  }, [form])

  async function onValid(values: CircleApplicationValues) {
    if (!userId) {
      toast.error(t('common:error.unauthorized'))
      return
    }
    if (!cut && !mine?.circle_cut_file_url) {
      toast.error(t('field.circleCut'), { description: t('field.circleCutHelp') })
      return
    }
    setBusy(true)
    try {
      const cutUrl = cut ? await upload(userId, cut) : mine!.circle_cut_file_url
      const sampleUrls = samples.length
        ? await Promise.all(samples.map((f) => upload(userId, f)))
        : (mine?.sample_works_images ?? null)

      await save.mutateAsync(
        payload('submitted', {
          circle_cut_file_url: cutUrl,
          sample_works_images: sampleUrls,
        }),
      )
      toast.success(t('application.submitted'))
      onSubmit?.(values)
    } catch (err) {
      toast.error(t('common:error.generic'), {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-10" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  // Already applied: the status page is the right screen, not a second form.
  if (mine && mine.application_status !== 'draft') return <CircleStatus eventId={eventId} />

  // Scoped to the five fields the price depends on. A bare `form.watch()` here
  // re-renders the whole form on every keystroke in every field, which is
  // visible lag on a phone.
  const total = quote(pricing.data, {
    space_type: priced[0],
    additional_table: priced[1],
    additional_chair: priced[2],
    additional_power: priced[3],
    exhibitor_passes: Number(priced[4]),
  })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('application.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {event?.name ? `${event.name} · ` : ''}
          {t('application.subtitle')}
        </p>
      </header>

      <FormProvider {...form}>
        <form className="mt-8 space-y-10" onSubmit={form.handleSubmit(onValid)} noValidate>
          <Section title={t('section.circle')}>
            <Grid>
              <Text name="circle_name" label={t('field.circleName')} required />
              <Text
                name="circle_name_furigana"
                label={t('field.circleNameFurigana')}
                hint={t('field.circleNameFuriganaHelp')}
                placeholder="ねこまちどう"
              />
              <Text name="pen_name" label={t('field.penName')} required />
              <Text name="pen_name_furigana" label={t('field.penNameFurigana')} />
            </Grid>
            <Area name="description" label={t('field.description')} required />
            <Area name="works_description" label={t('field.worksDescription')} />
          </Section>

          <Section title={t('section.contact')}>
            <Grid>
              <Text name="email" label={t('field.email')} type="email" required />
              <Text name="phone" label={t('field.phone')} type="tel" />
              <Text name="address" label="Address" />
              <Text name="postal_code" label="Postal code" />
              <Text name="country" label="Country" placeholder="ID" />
              <Text name="emergency_contact_name" label="Emergency contact" />
              <Text name="emergency_contact_phone" label="Emergency phone" type="tel" />
              <Text name="co_rep_name" label="Co-representative" />
              <Text name="co_rep_email" label="Co-representative email" type="email" />
              <Text name="co_rep_phone" label="Co-representative phone" type="tel" />
            </Grid>
          </Section>

          <Section title={t('section.works')}>
            <Grid>
              <Pick
                name="genre"
                label={t('field.genre')}
                required
                options={GENRES.map((g) => ({ value: g, label: g }))}
              />
              <Text name="fandom" label={t('field.fandom')} />
              <Pick
                name="rating"
                label={t('field.rating')}
                required
                options={[
                  { value: 'all_ages', label: t('rating.allAges') },
                  { value: 'r15', label: t('rating.r15') },
                  { value: 'r18', label: t('rating.r18') },
                ]}
              />
            </Grid>
            <ProductTypes />
            <Grid>
              <Text name="social_media_website" label={t('field.website')} placeholder="https://" />
              <Text name="social_media_twitter" label="X / Twitter" placeholder="@handle" />
              <Text name="social_media_pixiv" label="pixiv" placeholder="pixiv.net/users/…" />
              <Text name="social_media_instagram" label="Instagram" placeholder="@handle" />
              <Text name="marketplace_link" label="Online shop" placeholder="https://" />
            </Grid>
            <Check name="sells_commission" label="Takes commissions" />
            <Check name="previous_participation" label="Exhibited at this event before" />
          </Section>

          <Section title={t('section.booth')}>
            <Grid>
              <Pick
                name="space_type"
                label={t('field.spacePreference')}
                required
                options={SPACE_TYPES.map((s) => ({ value: s, label: SPACE_LABEL[s] }))}
              />
              <Text
                name="exhibitor_passes"
                label={t('field.exhibitorPasses')}
                type="number"
                min={1}
                max={4}
              />
            </Grid>
            <div className="grid gap-3 sm:grid-cols-3">
              <Check name="additional_table" label={t('field.additionalTable')} />
              <Check name="additional_chair" label={t('field.additionalChair')} />
              <Check name="additional_power" label={t('field.additionalPower')} />
            </div>
            <Area name="special_requests" label={t('field.specialRequests')} />

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-muted-foreground">{t('section.payment')}</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {formatMoney(total, event?.currency ?? 'IDR', i18n.language)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Quoted from the event price sheet. The organizer's server prices the
                application again on submit, and that figure is what you pay.
              </p>
            </div>
          </Section>

          <Section title={t('field.circleCut')}>
            <FilePick
              label={t('field.circleCut')}
              hint={t('field.circleCutHelp')}
              existing={mine?.circle_cut_file_url ?? null}
              files={cut ? [cut] : []}
              onPick={(picked) => setCut(picked[0] ?? null)}
              onRemove={() => setCut(null)}
            />
            <FilePick
              label="Sample works"
              hint="Up to 5 images. Optional, and separate from the circle cut."
              multiple
              existing={null}
              files={samples}
              onPick={(picked) => setSamples((prev) => [...prev, ...picked].slice(0, 5))}
              onRemove={(i) => setSamples((prev) => prev.filter((_, x) => x !== i))}
            />
          </Section>

          <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
            <p className="mr-auto text-xs text-muted-foreground" role="status">
              {draftSavedAt
                ? `${t('application.draftSaved')} · ${new Date(draftSavedAt).toLocaleTimeString(i18n.language)}`
                : ''}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void saveDraft()}
            >
              {t('common:action.saveDraft')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('application.submit')}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/**
 * ponytail: `event_pricing` has no hook in `src/lib/queries/` and that directory
 * belongs to P9, so the query lives here for one wave. Move it to
 * `queries/events.ts` as `useEventPricing` with a `queryKeys.events.pricing` key
 * the next time the seam is open.
 */
function useEventPricing(eventId: string) {
  return useList<EventPricingRow>(
    ['event_pricing', eventId],
    () => supabase.from('event_pricing').select('*').eq('event_id', eventId),
    { enabled: Boolean(eventId), staleTime: 5 * 60_000 },
  )
}

/** The client half of `circles_set_total_amount` (004). Advisory; the trigger wins. */
function quote(sheet: EventPricingRow[], v: Partial<CircleApplicationValues>): number {
  const row = sheet.find((p) => p.space_type === v.space_type)
  if (!row) return 0
  return (
    Number(row.price) +
    (v.additional_table ? Number(row.addon_table_price) : 0) +
    (v.additional_chair ? Number(row.addon_chair_price) : 0) +
    (v.additional_power ? Number(row.addon_power_price) : 0) +
    Math.max((v.exhibitor_passes ?? 1) - 1, 0) * Number(row.extra_pass_price)
  )
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * `${uid}/${uuid}.${ext}` in `circle-public`. The folder name IS the access
 * control: 006's policy checks `(storage.foldername(name))[1] = auth.uid()`, so
 * the old `sample-works/<random>` path 403s on every upload.
 *
 * The 5 MB check below is for the message, not for the rule — the bucket row
 * carries `file_size_limit` and `allowed_mime_types`, which is the control a
 * curl cannot walk around.
 */
async function upload(userId: string, file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`)
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('circle-public').upload(path, file)
  if (error) throw new Error(error.message)
  return supabase.storage.from('circle-public').getPublicUrl(path).data.publicUrl
}

function pickValues(row: CircleRow): Partial<CircleApplicationValues> {
  const out: Record<string, unknown> = {}
  const source = row as unknown as Record<string, unknown>
  for (const key of Object.keys(EMPTY)) {
    const value = source[key]
    if (value !== null && value !== undefined) out[key] = value
  }
  return out as Partial<CircleApplicationValues>
}

// ---------------------------------------------------------------------------
// Field helpers — react-hook-form via context, so a call site is one line
// ---------------------------------------------------------------------------

function useCtx() {
  return useFormContext<CircleApplicationValues>()
}

/**
 * ponytail: every text field goes through `Controller` rather than `register()`.
 * `src/components/ui/input.tsx` is a plain function component with no
 * `forwardRef`, so under React 18 the ref `register()` returns is dropped, the
 * field is never registered and `getValues()` comes back undefined — a form that
 * looks fine and submits nothing. Controller needs no ref. Upgrade path: add
 * `React.forwardRef` to that primitive (P7 owns it) or move to React 19, then
 * `register()` becomes the shorter option again.
 */

/** `FieldErrors` is a mapped type; indexing it with a union key needs the cast. */
function errorAt(errors: unknown, name: string): string | undefined {
  const message = (errors as Record<string, { message?: unknown } | undefined>)[name]?.message
  return message == null ? undefined : String(message)
}

type Name = FieldPath<CircleApplicationValues>

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-border pb-2 text-base font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

function ErrorText({ name }: { name: Name }) {
  const { formState } = useCtx()
  const message = errorAt(formState.errors, name)
  if (!message) return null
  return (
    <p id={`${name}-error`} className="text-sm text-destructive">
      {message}
    </p>
  )
}

function Text({
  name,
  label,
  hint,
  required,
  type = 'text',
  placeholder,
  min,
  max,
}: {
  name: Name
  label: string
  hint?: string
  required?: boolean
  type?: string
  placeholder?: string
  min?: number
  max?: number
}) {
  const form = useCtx()
  const invalid = Boolean(errorAt(form.formState.errors, name))
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Input
            id={name}
            type={type}
            min={min}
            max={max}
            placeholder={placeholder}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${name}-error` : hint ? `${name}-hint` : undefined}
            className="coarse:min-h-11"
            name={field.name}
            value={String(field.value ?? '')}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      {hint && (
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <ErrorText name={name} />
    </div>
  )
}

function Area({ name, label, required }: { name: Name; label: string; required?: boolean }) {
  const form = useCtx()
  const invalid = Boolean(errorAt(form.formState.errors, name))
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Textarea
            id={name}
            rows={4}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${name}-error` : undefined}
            name={field.name}
            value={String(field.value ?? '')}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <ErrorText name={name} />
    </div>
  )
}

function Pick({
  name,
  label,
  options,
  required,
}: {
  name: Name
  label: string
  required?: boolean
  options: { value: string; label: string }[]
}) {
  const form = useCtx()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={String(field.value ?? '')} onValueChange={field.onChange}>
            <SelectTrigger id={name} className="coarse:min-h-11">
              <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <ErrorText name={name} />
    </div>
  )
}

function Check({ name, label }: { name: Name; label: string }) {
  const form = useCtx()
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
          <Checkbox
            aria-label={typeof label === 'string' ? label : undefined}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            className="coarse:size-5"
          />
          {label}
        </label>
      )}
    />
  )
}

function ProductTypes() {
  const { t } = useTranslation('circle')
  const form = useCtx()
  const selected = form.watch('product_types') ?? []
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {t('field.productTypes')}
        <span className="text-destructive"> *</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {PRODUCT_TYPES.map((type) => {
          const on = selected.includes(type)
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() =>
                form.setValue(
                  'product_types',
                  on ? selected.filter((x) => x !== type) : [...selected, type],
                  { shouldDirty: true, shouldValidate: true },
                )
              }
              className={
                on
                  ? 'min-h-11 rounded-full border border-primary bg-primary/10 px-4 text-sm text-primary'
                  : 'min-h-11 rounded-full border border-border px-4 text-sm text-muted-foreground hover:bg-accent'
              }
            >
              {type}
            </button>
          )
        })}
      </div>
      <ErrorText name="product_types" />
    </fieldset>
  )
}

function FilePick({
  label,
  hint,
  files,
  existing,
  multiple,
  onPick,
  onRemove,
}: {
  label: string
  hint: string
  files: File[]
  existing: string | null
  multiple?: boolean
  onPick: (files: File[]) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-accent/40">
        <Upload className="size-5" aria-hidden="true" />
        <span>{hint}</span>
        <input
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp"
          multiple={multiple}
          onChange={(e) => {
            onPick(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </label>
      {(files.length > 0 || existing) && (
        <ul className="flex flex-wrap gap-3">
          {existing && files.length === 0 && (
            <li>
              <img
                src={existing}
                alt={label}
                className="size-24 rounded border border-border object-cover"
              />
            </li>
          )}
          {files.map((file, index) => (
            <li key={file.name + index} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="size-24 rounded border border-border object-cover"
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute -right-2 -top-2 size-6"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemove(index)}
              >
                <X className="size-3" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
