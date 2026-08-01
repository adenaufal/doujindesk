import { useMemo, useRef, useState } from 'react'
import { ExternalLink, Map as MapIcon, Minus, Plus, RotateCcw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BoothRow, CircleCatalogRow } from '@/lib/database.types'
import {
  BOOTH_STATUS,
  BOOTH_STATUSES,
  floorsOf,
  placement,
  toSvgViewBox,
} from '@/lib/floorplan'
import { useBooths, useCircleCatalog } from '@/lib/queries'
import { cn } from '@/lib/utils'

/**
 * The attendee floor map.
 *
 * Same geometry model as the organizer's editor (`src/lib/floorplan.ts`), read
 * only. If a booth moves in `BoothAllocation`, it moves here, because neither
 * file owns a second copy of what a rectangle is.
 *
 * The point of this screen is one job: find a circle's booth before walking the
 * hall. Everything else is in service of that — the search matches circle name,
 * kana reading, pen name and booth number, and choosing a result highlights the
 * booth and scrolls it into view.
 *
 * ponytail: zoom is `width: N%` on the SVG inside an `overflow-auto` box, so the
 * browser's own scrolling does the panning — no pointer maths, no gesture
 * library, and pinch-zoom on a phone still works on top of it. Upgrade path if
 * the map ever needs programmatic pan-to-point: animate the viewBox instead.
 */

const ZOOM_STEPS = [1, 1.5, 2, 3] as const

export default function InteractiveMap() {
  const { t } = useTranslation('floorplan')
  const { t: tc } = useTranslation()
  const { eventId } = useParams()

  const booths = useBooths(eventId)
  const catalog = useCircleCatalog(eventId)

  const [floor, setFloor] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoomIndex, setZoomIndex] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const boothRefs = useRef(new Map<string, SVGGElement | null>())

  const rows = booths.data
  const floors = useMemo(() => floorsOf(rows), [rows])
  const activeFloor = floor ?? floors[0] ?? 1
  const onFloor = useMemo(
    () => rows.filter((b) => b.floor_level === activeFloor && placement(b)),
    [rows, activeFloor],
  )
  const view = useMemo(() => toSvgViewBox(onFloor), [onFloor])

  const circleById = useMemo(() => {
    const map = new Map<string, CircleCatalogRow>()
    for (const circle of catalog.data) map.set(circle.id, circle)
    return map
  }, [catalog.data])

  const term = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!term) return []
    return rows
      .filter((booth) => {
        const circle = booth.circle_id ? circleById.get(booth.circle_id) : undefined
        return (
          booth.booth_number.toLowerCase().includes(term) ||
          (circle?.circle_name ?? '').toLowerCase().includes(term) ||
          (circle?.circle_name_furigana ?? '').toLowerCase().includes(term) ||
          (circle?.pen_name ?? '').toLowerCase().includes(term)
        )
      })
      .slice(0, 12)
  }, [rows, term, circleById])

  const selected = rows.find((b) => b.id === selectedId) ?? null
  const selectedCircle = selected?.circle_id ? circleById.get(selected.circle_id) : undefined

  /** Highlight + scroll-to. This replaces the old `alert('Getting directions…')`. */
  function focusBooth(booth: BoothRow) {
    setSelectedId(booth.id)
    if (booth.floor_level !== activeFloor) setFloor(booth.floor_level)
    if (!placement(booth)) return
    // A frame later, so a floor switch has rendered the target before we scroll.
    requestAnimationFrame(() => {
      boothRefs.current.get(booth.id)?.scrollIntoView?.({
        block: 'center',
        inline: 'center',
        behavior: 'smooth',
      })
    })
  }

  const isLoading = booths.isLoading || catalog.isLoading
  const error = booths.error ?? catalog.error

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <EmptyState
          icon={MapIcon}
          title={t('error.loadTitle')}
          description={error.message}
          action={
            <Button
              onClick={() => {
                booths.refetch()
                catalog.refetch()
              }}
            >
              {tc('action.retry')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('map.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('map.subtitle')}</p>
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="map-search">{t('map.searchPlaceholder')}</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="map-search"
            type="search"
            className="pl-9 coarse:min-h-11"
            placeholder={t('map.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {term && (
        <Card>
          <CardContent className="p-2">
            {matches.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">{t('map.noResults')}</p>
            ) : (
              <>
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  {t('map.results', { count: matches.length })}
                </p>
                <ul>
                  {matches.map((booth) => {
                    const circle = booth.circle_id ? circleById.get(booth.circle_id) : undefined
                    return (
                      <li key={booth.id}>
                        <button
                          type="button"
                          onClick={() => focusBooth(booth)}
                          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors coarse:min-h-11 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {circle?.circle_name ?? t('map.unallocated')}
                            </span>
                            {circle?.pen_name && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {circle.pen_name}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-sm tabular-nums">
                            {booth.booth_number}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {floors.length > 1 && (
        <div role="tablist" aria-label={t('detail.floor')} className="flex flex-wrap gap-2">
          {floors.map((level) => (
            <Button
              key={level}
              role="tab"
              aria-selected={level === activeFloor}
              variant={level === activeFloor ? 'secondary' : 'ghost'}
              size="sm"
              className="coarse:min-h-11"
              onClick={() => setFloor(level)}
            >
              {t('editor.floor', { level })}
            </Button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('editor.canvas')}</CardTitle>
          <CardAction className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('action.zoomOut')}
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            >
              <Minus aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('action.zoomIn')}
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            >
              <Plus aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('action.resetView')}
              onClick={() => {
                setZoomIndex(0)
                setSelectedId(null)
              }}
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-72 animate-pulse rounded-lg bg-muted" aria-busy="true" />
          ) : onFloor.length === 0 ? (
            <EmptyState
              icon={MapIcon}
              title={t('map.emptyTitle')}
              description={t('map.emptyBody')}
            />
          ) : (
            <div
              ref={scrollRef}
              className="h-72 overflow-auto rounded-lg border border-border bg-card sm:h-[26rem]"
            >
              <svg
                viewBox={view.value}
                preserveAspectRatio="xMidYMid meet"
                role="group"
                aria-label={t('editor.canvas')}
                style={{
                  width: `${ZOOM_STEPS[zoomIndex] * 100}%`,
                  aspectRatio: `${view.width} / ${view.height}`,
                }}
              >
                {onFloor.map((booth) => {
                  const box = placement(booth)!
                  const circle = booth.circle_id ? circleById.get(booth.circle_id) : undefined
                  const style = BOOTH_STATUS[booth.status]
                  const isSelected = booth.id === selectedId
                  const cx = box.position_x + box.size_width / 2
                  const cy = box.position_y + box.size_height / 2
                  return (
                    <g
                      key={booth.id}
                      ref={(node) => {
                        boothRefs.current.set(booth.id, node)
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${t('map.boothLabel', { number: booth.booth_number })} — ${
                        circle?.circle_name ?? t('map.unallocated')
                      }`}
                      aria-pressed={isSelected}
                      transform={`rotate(${booth.rotation} ${cx} ${cy})`}
                      className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-ring"
                      onClick={() => setSelectedId(booth.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedId(booth.id)
                        }
                      }}
                    >
                      <title>{`${booth.booth_number}${
                        circle ? ` — ${circle.circle_name}` : ''
                      }`}</title>
                      <rect
                        x={box.position_x}
                        y={box.position_y}
                        width={box.size_width}
                        height={box.size_height}
                        rx={0.08}
                        strokeWidth={isSelected ? 0.14 : 0.05}
                        className={cn(style.shape, isSelected && 'stroke-ring')}
                      />
                      <text
                        x={cx}
                        y={cy + 0.12}
                        textAnchor="middle"
                        className="pointer-events-none select-none fill-foreground"
                        style={{ fontSize: 0.34 }}
                      >
                        {booth.booth_number}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          )}

          <ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {BOOTH_STATUSES.map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <svg width="12" height="12" aria-hidden="true">
                  <rect
                    width="12"
                    height="12"
                    rx="2"
                    strokeWidth="1.5"
                    className={BOOTH_STATUS[status].shape}
                  />
                </svg>
                {t(`status.${status}`)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {selectedCircle?.circle_name ?? t('map.unallocated')}
            </CardTitle>
            {selectedCircle?.circle_name_furigana && (
              <p className="text-xs text-muted-foreground">
                {selectedCircle.circle_name_furigana}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t('detail.number')}</dt>
                <dd className="font-mono font-medium tabular-nums">{selected.booth_number}</dd>
              </div>
              {selected.zone && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('map.zone')}</dt>
                  <dd className="font-medium">{selected.zone}</dd>
                </div>
              )}
              {selectedCircle?.genre && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('map.genre')}</dt>
                  <dd className="font-medium">{selectedCircle.genre}</dd>
                </div>
              )}
              {selectedCircle?.rating && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('map.rating')}</dt>
                  <dd>
                    <Badge variant={selectedCircle.rating === 'all_ages' ? 'secondary' : 'warning'}>
                      {selectedCircle.rating.replace('_', ' ')}
                    </Badge>
                  </dd>
                </div>
              )}
            </dl>
            {selectedCircle?.description && (
              <p className="text-muted-foreground">{selectedCircle.description}</p>
            )}
            {selectedCircle && (
              <Button asChild variant="outline" className="coarse:min-h-11">
                <Link to={`/e/${eventId}/catalog`}>
                  <ExternalLink aria-hidden="true" />
                  {t('map.viewInCatalog')}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        onFloor.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">{t('map.selectHint')}</p>
        )
      )}
    </div>
  )
}
