import { useMemo, useState } from 'react'
import {
  ExternalLink,
  Filter,
  Link2,
  Map as MapIcon,
  Search,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { EmptyState } from './ui/empty-state'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useCircleCatalog } from '@/lib/queries'
import type { CircleCatalogRow } from '@/lib/database.types'

/**
 * The public circle catalog.
 *
 * READS `circle_catalog`, NEVER `circles` — through `useCircleCatalog`. The base
 * row carries email, phone, address and two emergency contacts; the view's column
 * list is the access control, and this screen is the reason it exists.
 *
 * ponytail: search and facets filter the cached array client-side instead of
 * round-tripping PostgREST per keystroke. One fetch per 5 minutes, instant
 * typing, and it keeps working when the venue wifi dies mid-browse. Ceiling: the
 * whole catalog sits in memory — fine at the ~1k circles a hall holds, not fine
 * at 10k. Upgrade path: `useCircleCatalog(eventId, { search })` already pushes an
 * `or(ilike)` to the server; switch to it and add a range.
 */

type FacetKey = 'genre' | 'fandom' | 'block' | 'rating'

interface Selection {
  genre: string[]
  fandom: string[]
  block: string[]
  rating: string[]
  shopOnly: boolean
}

const EMPTY: Selection = { genre: [], fandom: [], block: [], rating: [], shopOnly: false }
const FACET_KEYS: FacetKey[] = ['genre', 'fandom', 'block', 'rating']

const blockOf = (row: CircleCatalogRow) => row.booth_number?.split('-')[0] ?? ''
const hasShop = (row: CircleCatalogRow) => Boolean(row.marketplace_link ?? row.social_media_website)

/** `circles.rating` is an AGE rating (all_ages | r15 | r18), never a star score. */
function ratingLabel(value: string): string {
  if (value === 'all_ages') return 'All ages'
  if (value === 'r15') return 'R15'
  if (value === 'r18') return 'R18'
  return value
}

function facetValue(row: CircleCatalogRow, key: FacetKey): string {
  switch (key) {
    case 'genre':
      return row.genre ?? ''
    case 'fandom':
      return row.fandom ?? ''
    case 'block':
      return blockOf(row)
    case 'rating':
      return row.rating ?? ''
  }
}

export default function CircleCatalog() {
  const { eventId } = useParams()
  const { t, i18n } = useTranslation(['catalog', 'common'])
  const { data, isLoading, error, isEmpty, refetch } = useCircleCatalog(eventId)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Selection>(EMPTY)
  const [sort, setSort] = useState<'reading' | 'name' | 'booth'>(
    i18n.language.startsWith('ja') ? 'reading' : 'name',
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<CircleCatalogRow | null>(null)

  const collator = useMemo(
    () => new Intl.Collator(i18n.language, { numeric: true, sensitivity: 'base' }),
    [i18n.language],
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = data.filter((row) => {
      if (needle) {
        const hay = [
          row.circle_name,
          row.circle_name_furigana,
          row.pen_name,
          row.booth_number,
          row.genre,
          row.fandom,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      for (const key of FACET_KEYS) {
        const picked = selected[key]
        if (picked.length && !picked.includes(facetValue(row, key))) return false
      }
      if (selected.shopOnly && !hasShop(row)) return false
      return true
    })

    return [...matches].sort((a, b) => {
      if (sort === 'booth') return collator.compare(a.booth_number ?? 'zz', b.booth_number ?? 'zz')
      // `circle_name_sort_key` is the kana-folded key a trigger maintains, because
      // Postgres orders kanji by code point and that is not 五十音.
      if (sort === 'reading') {
        return collator.compare(
          a.circle_name_sort_key ?? a.circle_name,
          b.circle_name_sort_key ?? b.circle_name,
        )
      }
      return collator.compare(a.circle_name, b.circle_name)
    })
  }, [data, query, selected, sort, collator])

  const facets = useMemo(() => {
    const build = (key: FacetKey) => {
      const counts = new Map<string, number>()
      for (const row of data) {
        const value = facetValue(row, key)
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])
    }
    return {
      genre: build('genre'),
      fandom: build('fandom'),
      block: build('block'),
      rating: build('rating'),
      shop: data.filter(hasShop).length,
    }
  }, [data])

  const activeChips: { key: FacetKey | 'shopOnly'; value: string; label: string }[] = [
    ...FACET_KEYS.flatMap((key) =>
      selected[key].map((value) => ({
        key,
        value,
        label: key === 'rating' ? ratingLabel(value) : value,
      })),
    ),
    ...(selected.shopOnly
      ? [{ key: 'shopOnly' as const, value: '', label: t('filter.onlineShop') }]
      : []),
  ]

  function toggle(key: FacetKey, value: string) {
    setSelected((prev) => {
      const picked = prev[key]
      return {
        ...prev,
        [key]: picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value],
      }
    })
  }

  async function share(row: CircleCatalogRow) {
    const url = `${window.location.origin}/e/${eventId}/catalog?circle=${row.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('card.shared'))
    } catch {
      toast.error(t('common:error.generic'))
    }
  }

  const filterPanel = (
    <div className="space-y-6">
      <FacetGroup
        title={t('filter.genre')}
        entries={facets.genre}
        picked={selected.genre}
        onToggle={(value) => toggle('genre', value)}
      />
      <FacetGroup
        title={t('filter.fandom')}
        entries={facets.fandom}
        picked={selected.fandom}
        onToggle={(value) => toggle('fandom', value)}
      />
      <FacetGroup
        title={t('filter.rating')}
        entries={facets.rating}
        picked={selected.rating}
        onToggle={(value) => toggle('rating', value)}
        label={ratingLabel}
      />
      <FacetGroup
        title={t('filter.block')}
        entries={facets.block}
        picked={selected.block}
        onToggle={(value) => toggle('block', value)}
      />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('filter.onlineShop')}
        </h3>
        <label className="mt-2 flex items-center gap-2 py-1 text-sm coarse:min-h-11">
          <Checkbox
            aria-label={t('filter.onlineShop')}
            checked={selected.shopOnly}
            onCheckedChange={(value) =>
              setSelected((prev) => ({ ...prev, shopOnly: value === true }))
            }
          />
          <span className="flex-1 text-foreground">{t('filter.onlineShop')}</span>
          <span className="tabular-nums text-muted-foreground">{facets.shop}</span>
        </label>
      </div>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{t('subtitle')}</p>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="pl-9 coarse:min-h-11"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="lg:hidden"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
          >
            <Filter aria-hidden="true" />
            {t('filter.title')}
            {activeChips.length > 0 && (
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {activeChips.length}
              </Badge>
            )}
          </Button>
          <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
            <SelectTrigger className="w-40 coarse:min-h-11" aria-label={t('sort.label')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reading">{t('sort.reading')}</SelectItem>
              <SelectItem value="name">{t('sort.name')}</SelectItem>
              <SelectItem value="booth">{t('sort.booth')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {activeChips.map((chip) => (
            <button
              key={`${chip.key}-${chip.value}`}
              type="button"
              onClick={() =>
                chip.key === 'shopOnly'
                  ? setSelected((prev) => ({ ...prev, shopOnly: false }))
                  : toggle(chip.key, chip.value)
              }
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11"
            >
              {chip.label}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">{t('common:action.clearFilters')}</span>
            </button>
          ))}
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelected(EMPTY)}>
            {t('filter.clear')}
          </Button>
        </div>
      )}

      <div className="mt-6 flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <h2 className="text-sm font-semibold text-foreground">{t('filter.title')}</h2>
          <div className="mt-4">{filterPanel}</div>
        </aside>

        <main className="min-w-0 flex-1">
          {isLoading && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-40 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <EmptyState
              icon={Users}
              title={t('common:error.network')}
              description={error.message}
              action={
                <Button variant="outline" onClick={refetch}>
                  {t('common:action.retry')}
                </Button>
              }
            />
          )}

          {!isLoading && !error && isEmpty && (
            <EmptyState
              icon={Users}
              title={t('common:empty.noData.title')}
              description={t('common:empty.noData.description')}
            />
          )}

          {!isLoading && !error && !isEmpty && rows.length === 0 && (
            <EmptyState
              icon={Search}
              title={t('common:empty.noResults.title')}
              description={t('common:empty.noResults.description')}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(EMPTY)
                    setQuery('')
                  }}
                >
                  {t('common:action.clearFilters')}
                </Button>
              }
            />
          )}

          {rows.length > 0 && (
            <>
              <p className="mb-3 text-sm tabular-nums text-muted-foreground">
                {t('common:count.result', { count: rows.length })}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => (
                  <li key={row.id}>
                    <CircleCard
                      row={row}
                      revealed={revealed.has(row.id)}
                      onReveal={() => setRevealed((prev) => new Set(prev).add(row.id))}
                      onOpen={() => setDetail(row)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('filter.title')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>
          {filterPanel}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelected(EMPTY)}>
              {t('filter.clear')}
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              {t('filter.apply')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] space-y-4 overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-pretty">{detail.circle_name}</DialogTitle>
                <DialogDescription>
                  {t('card.penName')} {detail.pen_name}
                  {detail.circle_name_furigana ? ` · ${detail.circle_name_furigana}` : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-border px-2 py-1 font-mono text-sm tabular-nums text-foreground">
                  {detail.booth_number ?? t('card.noBooth')}
                </span>
                {detail.rating && (
                  <Badge variant={detail.rating === 'r18' ? 'warning' : 'secondary'}>
                    {ratingLabel(detail.rating)}
                  </Badge>
                )}
                {detail.genre && <Badge variant="outline">{detail.genre}</Badge>}
                {detail.fandom && <Badge variant="outline">{detail.fandom}</Badge>}
              </div>

              {detail.description && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground">{t('detail.about')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">
                    {detail.description}
                  </p>
                </section>
              )}
              {detail.works_description && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground">{t('detail.works')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">
                    {detail.works_description}
                  </p>
                </section>
              )}

              <div className="flex flex-wrap gap-2">
                {detail.booth_number && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/e/${eventId}/map?booth=${detail.booth_number}`}>
                      <MapIcon aria-hidden="true" />
                      {t('detail.showOnMap')}
                    </Link>
                  </Button>
                )}
                {detail.marketplace_link && (
                  <Button asChild variant="outline" size="sm">
                    <a href={detail.marketplace_link} target="_blank" rel="noreferrer noopener">
                      <ShoppingBag aria-hidden="true" />
                      {t('filter.onlineShop')}
                    </a>
                  </Button>
                )}
                {detail.social_media_twitter && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`https://x.com/${detail.social_media_twitter}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink aria-hidden="true" />@{detail.social_media_twitter}
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => void share(detail)}>
                  <Link2 aria-hidden="true" />
                  {t('card.share')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FacetGroup({
  title,
  entries,
  picked,
  onToggle,
  label,
}: {
  title: string
  entries: [string, number][]
  picked: string[]
  onToggle: (value: string) => void
  label?: (value: string) => string
}) {
  if (entries.length === 0) return null
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-2 space-y-1">
        {entries.map(([value, count]) => (
          <li key={value}>
            {/* aria-label, not the wrapping <label>: Radix renders a
                `button role="checkbox"`, and a button is not a labelable
                element — implicit label association gives it no name at all. */}
            <label className="flex items-center gap-2 py-1 text-sm coarse:min-h-11">
              <Checkbox
                aria-label={`${label ? label(value) : value} (${count})`}
                checked={picked.includes(value)}
                onCheckedChange={() => onToggle(value)}
              />
              <span className="flex-1 truncate text-foreground">{label ? label(value) : value}</span>
              <span className="tabular-nums text-muted-foreground">{count}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * R18 gating sits on the CARD, not on the detail page: a grid of covers is
 * exactly where an adult-only circle cut would otherwise be visible to everyone
 * standing behind you.
 */
function CircleCard({
  row,
  revealed,
  onReveal,
  onOpen,
}: {
  row: CircleCatalogRow
  revealed: boolean
  onReveal: () => void
  onOpen: () => void
}) {
  const { t } = useTranslation(['catalog', 'common'])

  if (row.rating === 'r18' && !revealed) {
    return (
      <div className="flex h-full flex-col justify-between gap-3 rounded-lg border border-warning/40 bg-warning-subtle p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm tabular-nums text-foreground">
            {row.booth_number ?? t('card.noBooth')}
          </span>
          <Badge variant="warning">R18</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t('card.r18Hidden')}</p>
        <Button variant="outline" size="sm" onClick={onReveal} className="self-start">
          {t('card.r18Reveal')}
        </Button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        {row.circle_cut_file_url ? (
          <img
            src={row.circle_cut_file_url}
            alt=""
            loading="lazy"
            className="size-12 shrink-0 rounded-md border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-lg font-semibold text-primary"
          >
            {row.circle_name.slice(0, 1)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-card-foreground">{row.circle_name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {t('card.penName')} {row.pen_name}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* The field attendees actually navigate by. Mono + tabular so a column of
            booth codes lines up on a phone. */}
        <span className="font-mono text-sm tabular-nums text-foreground">
          {row.booth_number ?? t('card.noBooth')}
        </span>
        {hasShop(row) && (
          <ShoppingBag
            className="size-4 text-muted-foreground"
            aria-label={t('filter.onlineShop')}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {row.genre && (
          <Badge variant="outline" className="max-w-full truncate">
            {row.genre}
          </Badge>
        )}
        {row.fandom && (
          <Badge variant="outline" className="max-w-full truncate">
            {row.fandom}
          </Badge>
        )}
        {row.rating === 'r15' && <Badge variant="secondary">R15</Badge>}
      </div>
    </button>
  )
}
