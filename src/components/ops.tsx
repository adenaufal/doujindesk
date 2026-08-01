import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

/**
 * The pieces the seven organizer/staff screens share.
 *
 * One module rather than a copy of the same four async branches in each file:
 * every list hook out of `@/lib/queries` returns the same
 * `{ isLoading, error, isEmpty, refetch }`, so the branches are written once and
 * a screen is left with only its own content. Nothing here knows about demo mode
 * — see the header of `src/lib/queries/index.ts`.
 */

// ---------------------------------------------------------------------------
// Page frame
// ---------------------------------------------------------------------------

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  // No min-h-screen: AppLayout already owns the full-height scroll container.
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 py-6 sm:py-8', className)}>{children}</div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {/* An admin page title is a heading, not a brand moment. */}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-8', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// The three async states, once
// ---------------------------------------------------------------------------

export interface AsyncState {
  isLoading: boolean
  error: Error | null
  isEmpty?: boolean
  refetch: () => void
}

export function Skeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn('h-16 animate-pulse rounded-lg bg-muted', className)} />
      ))}
    </div>
  )
}

/**
 * Loading → error+retry → empty → content. Callers pass the hook result straight
 * through, so a screen cannot accidentally ship only two of the three states.
 */
export function Async({
  state,
  icon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  skeleton,
  children,
}: {
  state: AsyncState
  icon?: LucideIcon
  emptyTitle?: string
  emptyDescription?: ReactNode
  emptyAction?: ReactNode
  skeleton?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation('common')

  if (state.isLoading) return <>{skeleton ?? <Skeleton />}</>

  if (state.error) {
    return (
      <EmptyState
        icon={icon}
        title={t('error.network')}
        description={state.error.message}
        action={
          <Button variant="outline" onClick={state.refetch}>
            {t('action.retry')}
          </Button>
        }
      />
    )
  }

  if (state.isEmpty) {
    return (
      <EmptyState
        icon={icon}
        title={emptyTitle ?? t('empty.noData.title')}
        description={emptyDescription ?? t('empty.noData.description')}
        action={emptyAction}
      />
    )
  }

  return <>{children}</>
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

/**
 * Flat surface, one border, the metric as the loudest element. `accent` is for
 * the single most important number on a screen — four equally loud cards means
 * none of them reads as more important than another.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
  loading = false,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  accent?: boolean
  loading?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <p
          className={cn(
            'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
            accent ? 'text-primary' : 'text-card-foreground',
          )}
        >
          {value}
        </p>
      )}
      {hint ? <p className="mt-1 text-xs text-muted-foreground text-pretty">{hint}</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trend chart
// ---------------------------------------------------------------------------

export interface TrendPoint {
  t: number
  v: number
}

/**
 * One series, cumulative, hairline stroke over a faint fill.
 *
 * Deliberately single-series: the two series this screen has (circle fees,
 * ticket revenue) differ by three orders of magnitude, so one shared y-axis
 * would draw circle fees flat on zero and a second y-axis would invent a
 * correlation. Two charts, each with its own scale printed, is the honest form.
 *
 * `--chart-1` and `--chart-2` were run through the dataviz validator in both
 * themes: adjacent ΔE 29.5 protan / 35.8 tritan, ≥3:1 against both surfaces.
 *
 * ponytail: raw SVG rather than a charting dependency — recharts is ~90 kB for
 * two sparklines. Ceiling: no axis ticks, no zoom, native `<title>` tooltips.
 * Upgrade path is a library the day someone asks for a brushable axis; the
 * ledger table underneath is the accessible table view meanwhile.
 */
export function TrendChart({
  points,
  label,
  colorClass,
  format,
  emptyLabel,
}: {
  points: TrendPoint[]
  label: string
  /** `text-chart-1` / `text-chart-2` — stroke and fill inherit from currentColor. */
  colorClass: string
  format: (value: number) => string
  emptyLabel: string
}) {
  const W = 240
  const H = 64

  if (points.length < 2) {
    return (
      <figure className="rounded-lg border border-border bg-card p-4">
        <figcaption className="text-sm font-medium text-card-foreground">{label}</figcaption>
        <p className="mt-6 text-sm text-muted-foreground">{emptyLabel}</p>
      </figure>
    )
  }

  const t0 = points[0].t
  const tSpan = Math.max(1, points[points.length - 1].t - t0)
  const peak = Math.max(...points.map((p) => p.v), 0)
  const floor = Math.min(...points.map((p) => p.v), 0)
  const vSpan = Math.max(1, peak - floor)

  const x = (p: TrendPoint) => ((p.t - t0) / tSpan) * W
  const y = (p: TrendPoint) => H - ((p.v - floor) / vSpan) * (H - 6) - 3

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p).toFixed(1)} ${y(p).toFixed(1)}`)
  const area = `${line.join(' ')} L${W} ${H} L0 ${H} Z`
  const last = points[points.length - 1]

  return (
    <figure className="rounded-lg border border-border bg-card p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-card-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-card-foreground">
          {format(last.v)}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={cn('mt-3 h-16 w-full overflow-visible', colorClass)}
        role="img"
        aria-label={`${label}: ${format(last.v)}`}
      >
        <path d={area} fill="currentColor" opacity={0.12} />
        <path
          d={line.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p) => (
          // Native tooltips: no state, no listeners, and they survive a re-render
          // mid-scroll. The ledger table below is the full accessible view.
          <circle key={p.t} cx={x(p)} cy={y(p)} r={6} fill="transparent">
            <title>{`${new Date(p.t).toLocaleDateString()} — ${format(p.v)}`}</title>
          </circle>
        ))}
        <circle cx={x(last)} cy={y(last)} r={3} fill="currentColor" vectorEffect="non-scaling-stroke" />
      </svg>

      <p className="mt-2 text-xs text-muted-foreground">
        {new Date(t0).toLocaleDateString()} – {new Date(last.t).toLocaleDateString()}
      </p>
    </figure>
  )
}
