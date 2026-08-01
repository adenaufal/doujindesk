import { useMemo, useRef, useState } from 'react'
import { Download, LayoutGrid, Loader2, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { BoothRow, BoothStatus, CircleRow } from '@/lib/database.types'
import {
  BOOTH_STATUS,
  BOOTH_STATUSES,
  GRID,
  exportPlan,
  findCollisions,
  floorsOf,
  importPlan,
  nextBoothNumber,
  placement,
  round2,
  snap,
  toSvgViewBox,
  type Point,
} from '@/lib/floorplan'
import {
  BOOTH_DUPLICATE,
  BOOTH_OVERLAP,
  queryKeys,
  useBooths,
  useCircles,
  useCreateBooth,
  useDeleteBooth,
  useRealtimeTable,
  useUpdateBooth,
  useWrite,
} from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

/**
 * The organizer's floor-plan editor.
 *
 * Geometry lives in `src/lib/floorplan.ts` and is shared with the attendee map —
 * this file draws, it does not decide what overlaps. Collision is arbitrated by
 * the database (migration 006: `booths_no_overlap` 23P01, `one_booth_per_circle`
 * 23505); the client pre-check exists so the organizer gets an answer in 0 ms
 * instead of 200 ms, and the server's answer always wins the argument.
 */

const DEFAULT_SIZE = { width: 2, height: 1 }

/**
 * Allocation as a CONDITIONAL update: `WHERE id = $1 AND circle_id IS NULL`.
 *
 * Zero rows back means another organizer claimed the booth between this screen's
 * last refetch and this click. There is no client-side check that fixes that —
 * two laptops both pass any check you write — so the write itself has to carry
 * the condition, and the empty result set is the conflict signal.
 *
 * ponytail: this hook belongs beside `useUpdateBooth` in
 * `src/lib/queries/booths.ts`, which package P9 owns and this package must not
 * write to. Move it there when the ownership fence comes down; nothing else
 * changes, the call site is already hook-shaped.
 */
function useAllocateBooth(eventId: string) {
  return useWrite(
    async (args: { booth: BoothRow; circleId: string | null }) => {
      if (args.circleId === null) {
        // Freeing is unconditional and idempotent: whoever holds it, it ends free.
        const { error } = await supabase
          .from('booths')
          .update({ circle_id: null, status: 'available' })
          .eq('id', args.booth.id)
        if (error) throw Object.assign(new Error(error.message), { code: error.code })
        return { claimedBy: null }
      }

      const { data, error } = await supabase
        .from('booths')
        .update({ circle_id: args.circleId, status: 'occupied' })
        .eq('id', args.booth.id)
        .is('circle_id', null)
        .select()

      if (error) throw Object.assign(new Error(error.message), { code: error.code })
      if (!data || data.length === 0) {
        // Read back who won, so the message names them instead of shrugging.
        const { data: fresh } = await supabase
          .from('booths')
          .select('*')
          .eq('id', args.booth.id)
          .maybeSingle()
        throw Object.assign(new Error('booth taken'), {
          code: 'TAKEN',
          claimedBy: (fresh as BoothRow | null)?.circle_id ?? null,
        })
      }
      return { claimedBy: args.circleId }
    },
    () => [queryKeys.booths.list(eventId), queryKeys.circles.catalog(eventId)],
  )
}

export default function BoothAllocation() {
  const { t } = useTranslation('floorplan')
  const { t: tc } = useTranslation()
  const { eventId } = useParams()
  const id = eventId ?? ''

  const booths = useBooths(eventId)
  const circles = useCircles(eventId, { status: 'accepted' })
  useRealtimeTable('booths', queryKeys.booths.list(id), { eventId: id, enabled: Boolean(eventId) })

  const updateBooth = useUpdateBooth(id)
  const createBooth = useCreateBooth(id)
  const deleteBooth = useDeleteBooth(id)
  const allocate = useAllocateBooth(id)

  const [floor, setFloor] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BoothStatus | 'all'>('all')
  const [addMode, setAddMode] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [drag, setDrag] = useState<{ id: string; grabX: number; grabY: number; at: Point } | null>(
    null,
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const rows = booths.data
  const floors = useMemo(() => floorsOf(rows), [rows])
  const activeFloor = floor ?? floors[0] ?? 1
  const onFloor = useMemo(
    () => rows.filter((b) => b.floor_level === activeFloor),
    [rows, activeFloor],
  )
  const placed = useMemo(() => onFloor.filter((b) => placement(b)), [onFloor])
  const view = useMemo(() => toSvgViewBox(placed), [placed])

  const circleName = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of circles.data) map.set(c.id, c.circle_name)
    return map
  }, [circles.data])

  const term = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      onFloor.filter((b) => {
        const name = b.circle_id ? (circleName.get(b.circle_id) ?? '') : ''
        const matches =
          !term ||
          b.booth_number.toLowerCase().includes(term) ||
          name.toLowerCase().includes(term) ||
          (b.label ?? '').toLowerCase().includes(term)
        return matches && (statusFilter === 'all' || b.status === statusFilter)
      }),
    [onFloor, term, statusFilter, circleName],
  )

  const selected = rows.find((b) => b.id === selectedId) ?? null
  const stats = {
    total: rows.length,
    available: rows.filter((b) => b.status === 'available').length,
    occupied: rows.filter((b) => b.circle_id).length,
    unplaced: rows.filter((b) => !placement(b)).length,
  }

  // Accepted circles that do not hold a booth yet — the only legal candidates,
  // because `one_booth_per_circle` rejects the rest with 23505 anyway.
  const heldBy = new Set(rows.map((b) => b.circle_id).filter(Boolean) as string[])
  const candidates: CircleRow[] = circles.data.filter((c) => !heldBy.has(c.id))

  // ---------------------------------------------------------------------------
  // Writes. Every one of them surfaces the database's SQLSTATE by name.
  // ---------------------------------------------------------------------------

  function describeError(error: unknown, booth: BoothRow): string {
    const code = (error as { code?: string } | null)?.code
    // 23P01 does not say WHICH booth was in the way — the exclusion constraint
    // only reports that the new key conflicted. Naming the booth being moved is
    // the honest phrasing; the client-side pre-check is what names the obstacle.
    if (code === BOOTH_OVERLAP) return t('conflict.overlapServer', { booth: booth.booth_number })
    if (code === BOOTH_DUPLICATE)
      return t('conflict.duplicateNumber', { booth: booth.booth_number })
    if (code === 'TAKEN') {
      const claimedBy = (error as { claimedBy?: string | null }).claimedBy
      const name = claimedBy ? circleName.get(claimedBy) : undefined
      return name
        ? t('conflict.taken', { booth: booth.booth_number, circle: name })
        : t('conflict.takenUnknown', { booth: booth.booth_number })
    }
    return (error as Error | null)?.message ?? tc('error.generic')
  }

  function moveTo(booth: BoothRow, at: Point) {
    const next = { ...booth, position_x: at.x, position_y: at.y }
    const hits = findCollisions(next, onFloor)
    if (hits.length > 0) {
      toast.error(t('conflict.overlap', { booths: hits.map((b) => b.booth_number).join(', ') }))
      return
    }
    updateBooth.mutate(
      { id: booth.id, patch: { position_x: at.x, position_y: at.y } },
      {
        onSuccess: () => toast.success(t('toast.moved', { booth: booth.booth_number })),
        onError: (error) => toast.error(describeError(error, booth)),
      },
    )
  }

  function placeNew(at: Point) {
    const number = nextBoothNumber(rows, activeFloor === 1 ? 'A' : `F${activeFloor}`)
    const draft = {
      booth_number: number,
      booth_type: 'circle_space_1',
      position_x: at.x,
      position_y: at.y,
      size_width: DEFAULT_SIZE.width,
      size_height: DEFAULT_SIZE.height,
      floor_level: activeFloor,
      status: 'available' as const,
    }
    const hits = findCollisions(draft, onFloor)
    if (hits.length > 0) {
      toast.error(t('conflict.overlap', { booths: hits.map((b) => b.booth_number).join(', ') }))
      return
    }
    createBooth.mutate(draft, {
      onSuccess: (row) => {
        setSelectedId(row.id)
        toast.success(t('toast.created', { booth: number }))
      },
      onError: (error) =>
        toast.error(describeError(error, { ...draft, booth_number: number } as BoothRow)),
    })
  }

  function allocateTo(booth: BoothRow, circleId: string | null) {
    allocate.mutate(
      { booth, circleId },
      {
        onSuccess: () =>
          toast.success(
            circleId
              ? t('toast.allocated', {
                  booth: booth.booth_number,
                  circle: circleName.get(circleId) ?? '',
                })
              : t('toast.freed', { booth: booth.booth_number }),
          ),
        onError: (error) => toast.error(describeError(error, booth)),
      },
    )
  }

  async function clearPlacements() {
    setClearOpen(false)
    const targets = placed
    for (const booth of targets) {
      await updateBooth.mutateAsync({
        id: booth.id,
        patch: { position_x: null, position_y: null },
      })
    }
    toast.success(t('toast.cleared', { count: targets.length }))
  }

  function handleExport() {
    const plan = exportPlan(rows)
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `floorplan-${id.slice(0, 8)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('toast.exported'))
  }

  /**
   * ponytail: import is one UPDATE (or INSERT) per booth, serially. A 600-booth
   * hall is 600 round trips — slow but correct, and it is a once-per-event
   * action. Upgrade path if that ever hurts: a `SECURITY DEFINER` RPC taking the
   * whole plan as jsonb and doing one `INSERT … ON CONFLICT (event_id,
   * booth_number) DO UPDATE`, which also makes the import atomic.
   */
  async function handleImport(file: File) {
    let updated = 0
    let created = 0
    try {
      const plan = importPlan(await file.text())
      const byNumber = new Map(rows.map((b) => [b.booth_number, b]))
      for (const entry of plan.booths) {
        const existing = byNumber.get(entry.booth_number)
        if (existing) {
          await updateBooth.mutateAsync({ id: existing.id, patch: entry })
          updated++
        } else {
          await createBooth.mutateAsync({ ...entry, status: 'available' })
          created++
        }
      }
      toast.success(t('toast.imported', { updated, created }))
    } catch (error) {
      toast.error(t('error.importFailed'), { description: (error as Error).message })
    }
  }

  // ---------------------------------------------------------------------------
  // Pointer / keyboard geometry
  // ---------------------------------------------------------------------------

  /** Screen pixels to floor metres. The viewBox mapping is scale + translate. */
  function toFloor(event: { clientX: number; clientY: number }): Point | null {
    const ctm = svgRef.current?.getScreenCTM?.()
    if (!ctm || !ctm.a || !ctm.d) return null
    return { x: (event.clientX - ctm.e) / ctm.a, y: (event.clientY - ctm.f) / ctm.d }
  }

  function onBoothPointerDown(event: React.PointerEvent, booth: BoothRow) {
    if (addMode) return
    const box = placement(booth)
    const point = toFloor(event)
    if (!box || !point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      id: booth.id,
      grabX: point.x - box.position_x,
      grabY: point.y - box.position_y,
      at: { x: box.position_x, y: box.position_y },
    })
  }

  function onBoothPointerMove(event: React.PointerEvent) {
    if (!drag) return
    const point = toFloor(event)
    if (!point) return
    setDrag({
      ...drag,
      at: {
        x: Math.max(0, snap(point.x - drag.grabX)),
        y: Math.max(0, snap(point.y - drag.grabY)),
      },
    })
  }

  function onBoothPointerUp(booth: BoothRow) {
    if (!drag || drag.id !== booth.id) return
    const box = placement(booth)
    const { at } = drag
    setDrag(null)
    if (box && (at.x !== box.position_x || at.y !== box.position_y)) moveTo(booth, at)
    else setSelectedId(booth.id)
  }

  /** Keyboard equivalent of the drag, which is the whole a11y story for a canvas. */
  function onBoothKeyDown(event: React.KeyboardEvent, booth: BoothRow) {
    const box = placement(booth)
    const step: Record<string, Point> = {
      ArrowLeft: { x: -GRID, y: 0 },
      ArrowRight: { x: GRID, y: 0 },
      ArrowUp: { x: 0, y: -GRID },
      ArrowDown: { x: 0, y: GRID },
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedId(booth.id)
      return
    }
    const delta = step[event.key]
    if (!delta || !box) return
    event.preventDefault()
    moveTo(booth, {
      x: Math.max(0, round2(box.position_x + delta.x)),
      y: Math.max(0, round2(box.position_y + delta.y)),
    })
  }

  // ---------------------------------------------------------------------------

  if (booths.error) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4">
        <EmptyState
          icon={LayoutGrid}
          title={t('error.loadTitle')}
          description={booths.error.message}
          action={<Button onClick={booths.refetch}>{tc('action.retry')}</Button>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t('editor.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('editor.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={addMode ? 'default' : 'outline'}
            className="coarse:min-h-11"
            onClick={() => setAddMode((v) => !v)}
          >
            {addMode ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {addMode ? t('action.stopAdding') : t('action.addBooth')}
          </Button>
          <Button variant="outline" className="coarse:min-h-11" onClick={handleExport}>
            <Download aria-hidden="true" />
            {t('action.export')}
          </Button>
          <Button
            variant="outline"
            className="coarse:min-h-11"
            onClick={() => fileRef.current?.click()}
          >
            <Upload aria-hidden="true" />
            {t('action.import')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label={t('action.import')}
            tabIndex={-1}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void handleImport(file)
            }}
          />
          <Button
            variant="outline"
            className="coarse:min-h-11"
            disabled={placed.length === 0}
            onClick={() => setClearOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            {t('action.clear')}
          </Button>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['total', 'available', 'occupied', 'unplaced'] as const).map((key) => (
          <Card key={key}>
            <CardContent className="p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`stat.${key}`)}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {booths.isLoading ? '—' : stats[key]}
              </dd>
            </CardContent>
          </Card>
        ))}
      </dl>

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{t('editor.canvas')}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {addMode ? t('editor.placeHint') : t('editor.hint')}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {booths.isLoading ? (
              <div className="h-[22rem] animate-pulse rounded-lg bg-muted" />
            ) : placed.length === 0 ? (
              <EmptyState
                icon={LayoutGrid}
                title={t('editor.emptyTitle')}
                description={t('editor.emptyBody')}
                action={
                  <Button onClick={() => setAddMode(true)} className="coarse:min-h-11">
                    <Plus aria-hidden="true" />
                    {t('action.addBooth')}
                  </Button>
                }
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <svg
                  ref={svgRef}
                  viewBox={view.value}
                  className={cn(
                    'h-[22rem] w-full touch-none sm:h-[30rem]',
                    addMode && 'cursor-crosshair',
                  )}
                  role="group"
                  aria-label={t('editor.canvas')}
                >
                  <defs>
                    <pattern id="fp-grid" width={1} height={1} patternUnits="userSpaceOnUse">
                      <path
                        d="M 1 0 L 0 0 0 1"
                        fill="none"
                        className="stroke-border"
                        strokeWidth={0.02}
                      />
                    </pattern>
                  </defs>
                  {/* The background carries the place-a-booth handler, not the
                      <svg>: a pointerdown on a booth bubbles up, and dropping a
                      new booth on top of the one you just tapped is never what
                      anybody meant. */}
                  <rect
                    x={view.x}
                    y={view.y}
                    width={view.width}
                    height={view.height}
                    fill="url(#fp-grid)"
                    onPointerDown={(event) => {
                      if (!addMode) return
                      const point = toFloor(event)
                      if (point) {
                        placeNew({ x: Math.max(0, snap(point.x)), y: Math.max(0, snap(point.y)) })
                      }
                    }}
                  />

                  {onFloor.map((booth) => {
                    const box = placement(booth)
                    if (!box) return null
                    const dragging = drag?.id === booth.id
                    const x = dragging ? drag.at.x : box.position_x
                    const y = dragging ? drag.at.y : box.position_y
                    const style = BOOTH_STATUS[booth.status]
                    const label = booth.circle_id ? circleName.get(booth.circle_id) : null
                    const dimmed = filtered.length !== onFloor.length && !filtered.includes(booth)
                    return (
                      <g
                        key={booth.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`${booth.booth_number} — ${t(style.labelKey)}${
                          label ? ` — ${label}` : ''
                        }`}
                        transform={`rotate(${booth.rotation} ${x + box.size_width / 2} ${
                          y + box.size_height / 2
                        })`}
                        className={cn(
                          'cursor-grab outline-none focus-visible:[&>rect]:stroke-ring',
                          dragging && 'cursor-grabbing',
                          dimmed && 'opacity-30',
                        )}
                        onPointerDown={(event) => onBoothPointerDown(event, booth)}
                        onPointerMove={onBoothPointerMove}
                        onPointerUp={() => onBoothPointerUp(booth)}
                        onKeyDown={(event) => onBoothKeyDown(event, booth)}
                      >
                        <title>{`${booth.booth_number}${label ? ` — ${label}` : ''}`}</title>
                        <rect
                          x={x}
                          y={y}
                          width={box.size_width}
                          height={box.size_height}
                          rx={0.08}
                          strokeWidth={selectedId === booth.id ? 0.12 : 0.05}
                          className={cn(
                            style.shape,
                            selectedId === booth.id && 'stroke-ring',
                          )}
                        />
                        <text
                          x={x + box.size_width / 2}
                          y={y + box.size_height / 2 + 0.12}
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
              <li className="ml-auto">{t('editor.grid', { size: GRID })}</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('list.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="booth-search">{t('filter.search')}</Label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="booth-search"
                  className="pl-9"
                  placeholder={t('filter.searchPlaceholder')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="booth-status">{t('filter.status')}</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as BoothStatus | 'all')}
              >
                <SelectTrigger id="booth-status" className="coarse:min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filter.allStatuses')}</SelectItem>
                  {BOOTH_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('list.count', { shown: filtered.length, total: onFloor.length })}
            </p>

            <Separator />

            {booths.isLoading ? (
              <div className="space-y-2" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                className="py-8"
                title={
                  onFloor.length === 0 ? t('editor.emptyTitle') : tc('empty.noResults.title')
                }
                description={
                  onFloor.length === 0 ? t('editor.emptyBody') : t('list.noResults')
                }
                secondaryAction={
                  term || statusFilter !== 'all' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('all')
                      }}
                    >
                      {tc('action.clearFilters')}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="max-h-[24rem] space-y-1.5 overflow-y-auto">
                {filtered.map((booth) => {
                  const label = booth.circle_id ? circleName.get(booth.circle_id) : null
                  return (
                    <li key={booth.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(booth.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md border border-border p-2.5 text-left transition-colors coarse:min-h-11',
                          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selectedId === booth.id && 'border-ring bg-accent',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium tabular-nums">
                            {booth.booth_number}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {label ?? (placement(booth) ? booth.booth_type : t('editor.unplaced'))}
                          </span>
                        </span>
                        <Badge variant={BOOTH_STATUS[booth.status].badge}>
                          {t(`status.${booth.status}`)}
                        </Badge>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <BoothDialog
          booth={selected}
          circleName={selected.circle_id ? (circleName.get(selected.circle_id) ?? null) : null}
          candidates={candidates}
          busy={updateBooth.isPending || allocate.isPending || deleteBooth.isPending}
          onClose={() => setSelectedId(null)}
          onAllocate={(circleId) => allocateTo(selected, circleId)}
          onDelete={() => {
            deleteBooth.mutate(selected.id, {
              onSuccess: () => {
                setSelectedId(null)
                toast.success(t('toast.deleted', { booth: selected.booth_number }))
              },
              onError: (error) => toast.error(describeError(error, selected)),
            })
          }}
          onSave={(patch) => {
            const hits = findCollisions({ ...selected, ...patch }, rows)
            if (hits.length > 0) {
              toast.error(
                t('conflict.overlap', { booths: hits.map((b) => b.booth_number).join(', ') }),
              )
              return
            }
            updateBooth.mutate(
              { id: selected.id, patch },
              {
                onSuccess: () => {
                  setSelectedId(null)
                  toast.success(t('toast.saved', { booth: selected.booth_number }))
                },
                onError: (error) => toast.error(describeError(error, selected)),
              },
            )
          }}
        />
      )}

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clear.title', { level: activeFloor })}</DialogTitle>
            <DialogDescription>
              {t('clear.body', { count: placed.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              {tc('action.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void clearPlacements()}>
              {t('clear.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// -----------------------------------------------------------------------------

interface BoothDialogProps {
  booth: BoothRow
  circleName: string | null
  candidates: CircleRow[]
  busy: boolean
  onClose: () => void
  onSave: (patch: Partial<BoothRow>) => void
  onAllocate: (circleId: string | null) => void
  onDelete: () => void
}

const NONE = '__none__'

function BoothDialog({
  booth,
  circleName,
  candidates,
  busy,
  onClose,
  onSave,
  onAllocate,
  onDelete,
}: BoothDialogProps) {
  const { t } = useTranslation('floorplan')
  const { t: tc } = useTranslation()
  const [form, setForm] = useState(() => ({
    booth_number: booth.booth_number,
    booth_type: booth.booth_type,
    zone: booth.zone ?? '',
    status: booth.status,
    size_width: String(booth.size_width ?? DEFAULT_SIZE.width),
    size_height: String(booth.size_height ?? DEFAULT_SIZE.height),
    position_x: booth.position_x == null ? '' : String(booth.position_x),
    position_y: booth.position_y == null ? '' : String(booth.position_y),
    floor_level: String(booth.floor_level),
  }))

  const num = (value: string): number | null => {
    const parsed = Number(value)
    return value.trim() === '' || Number.isNaN(parsed) ? null : round2(parsed)
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: event.target.value })),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('detail.title', { number: booth.booth_number })}</DialogTitle>
          <DialogDescription>
            {circleName ?? t('detail.noCircle')}
            {!placement(booth) && ` — ${t('detail.unplacedNote')}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bd-number">{t('detail.number')}</Label>
            <Input id="bd-number" {...field('booth_number')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-type">{t('detail.type')}</Label>
            <Input id="bd-type" {...field('booth_type')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-zone">{t('detail.zone')}</Label>
            <Input id="bd-zone" {...field('zone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-status">{t('detail.status')}</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value as BoothStatus }))}
            >
              <SelectTrigger id="bd-status" className="coarse:min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOTH_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-w">{t('detail.width')}</Label>
            <Input id="bd-w" type="number" step="0.5" inputMode="decimal" {...field('size_width')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-h">{t('detail.height')}</Label>
            <Input
              id="bd-h"
              type="number"
              step="0.5"
              inputMode="decimal"
              {...field('size_height')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-x">{t('detail.x')}</Label>
            <Input id="bd-x" type="number" step="0.5" inputMode="decimal" {...field('position_x')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-y">{t('detail.y')}</Label>
            <Input id="bd-y" type="number" step="0.5" inputMode="decimal" {...field('position_y')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-floor">{t('detail.floor')}</Label>
            <Input id="bd-floor" type="number" step="1" inputMode="numeric" {...field('floor_level')} />
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="bd-circle">{t('detail.circle')}</Label>
          {booth.circle_id ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
              <span className="min-w-0 truncate text-sm font-medium">{circleName}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                className="coarse:min-h-11"
                onClick={() => onAllocate(null)}
              >
                {t('action.unassign')}
              </Button>
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('detail.noCandidates')}</p>
          ) : (
            <Select
              value={NONE}
              onValueChange={(value) => value !== NONE && onAllocate(value)}
              disabled={busy}
            >
              <SelectTrigger id="bd-circle" className="coarse:min-h-11">
                <SelectValue placeholder={t('detail.pickCircle')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('detail.pickCircle')}</SelectItem>
                {candidates.map((circle) => (
                  <SelectItem key={circle.id} value={circle.id}>
                    {circle.circle_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive coarse:min-h-11"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
            {t('action.delete')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="coarse:min-h-11" onClick={onClose}>
              {tc('action.cancel')}
            </Button>
            <Button
              className="coarse:min-h-11"
              disabled={busy}
              onClick={() =>
                onSave({
                  booth_number: form.booth_number.trim(),
                  booth_type: form.booth_type.trim(),
                  zone: form.zone.trim() || null,
                  status: form.status,
                  size_width: num(form.size_width),
                  size_height: num(form.size_height),
                  position_x: num(form.position_x),
                  position_y: num(form.position_y),
                  floor_level: Number(form.floor_level) || 1,
                })
              }
            >
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {tc('action.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
