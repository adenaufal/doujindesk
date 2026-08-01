/**
 * ============================================================================
 * ONE GEOMETRY MODEL. The organizer editor (`BoothAllocation`) and the attendee
 * map (`InteractiveMap`) both read this file and nothing else. Two models that
 * drift is the failure mode this file exists to prevent.
 * ============================================================================
 *
 * A convention floor is a fixed coordinate plane in METRES, not a globe:
 * `position_x` / `position_y` are the top-left corner of an axis-aligned
 * rectangle `size_width` x `size_height`, all `numeric(8,2)` in the `booths`
 * table. No tiles, no projection, no lat/lng — an SVG `viewBox` is the whole
 * camera. (leaflet was removed in P3: it wants CDN map tiles, which is the one
 * thing that will not work at the venue.)
 *
 * COLLISION IS THE DATABASE'S JOB. Migration 006 carries
 * `EXCLUDE USING gist (event_id =, floor_level =, box(...) &&)`, so an
 * overlapping placement comes back as SQLSTATE 23P01 and a second circle in a
 * booth comes back as 23505 from `one_booth_per_circle`. `overlaps()` here is
 * a mirror of that constraint, kept for feedback speed — it tells the organizer
 * *before* the round-trip. It is not the authority, and it cannot be: two
 * organizers on two laptops both pass a client-side check and both submit.
 *
 * ponytail: `findCollisions` is an O(n) AABB scan over one floor. At convention
 * scale (a big hall is ~600 booths) that is microseconds per drag. Upgrade path
 * if a floor ever exceeds ~2k booths: bucket booths into a uniform grid keyed
 * by floor(x / 10) and scan the 9 neighbouring cells.
 */

import { z } from 'zod'

import type { BoothRow, BoothStatus } from './database.types'

/**
 * The inset that migration 006 bakes into the exclusion constraint, in metres.
 *
 * Postgres `box && box` counts boxes that merely *touch* as overlapping, and
 * convention aisles are laid out edge to edge — A-02 flush against A-01 must be
 * legal. 006 shrinks each box by 0.01 on every side to buy that back, and this
 * constant reproduces it exactly. Consequence, and it is deliberate: an
 * interpenetration of 0.01 m is accepted by both the database and this function.
 * The editor's grid step is 250x that, so it is not reachable by dragging.
 */
export const EPSILON = 0.01

/** Editor grid, in metres. Half a metre is the smallest gap a person fits in. */
export const GRID = 0.5

/** Coordinates are `numeric(8,2)`; sending more precision than that is a lie. */
export const round2 = (n: number): number => Math.round(n * 100) / 100

export interface Point {
  x: number
  y: number
}

/** A booth that has been placed on the canvas. Every field is non-null. */
export interface Placement {
  position_x: number
  position_y: number
  size_width: number
  size_height: number
  floor_level: number
}

/** The subset of `booths` the geometry needs. Anything wider is a `BoothRow`. */
export type Placeable = Pick<
  BoothRow,
  'id' | 'position_x' | 'position_y' | 'size_width' | 'size_height' | 'floor_level'
>

/**
 * Narrow a booth row to a placement, or null if it has not been placed yet.
 *
 * NULL is not an error state. A box with a NULL coordinate is NULL, and an
 * exclusion constraint ignores NULL keys — so an un-placed booth is exempt in
 * Postgres, and it is exempt here. That is what makes "create the booth, place
 * it later" work in the editor.
 */
export function placement(booth: Partial<Placeable>): Placement | null {
  const { position_x, position_y, size_width, size_height } = booth
  if (
    position_x == null ||
    position_y == null ||
    size_width == null ||
    size_height == null
  ) {
    return null
  }
  return {
    position_x,
    position_y,
    size_width,
    size_height,
    floor_level: booth.floor_level ?? 1,
  }
}

/**
 * Do two placed booths share floor space?
 *
 * Mirrors 006 exactly: same floor, then inset-AABB intersection on closed
 * intervals. Booths on different floors never collide however identical their
 * coordinates — a mezzanine sits directly above the hall by definition.
 *
 * Rotation is OUT OF SCOPE, in both directions. `booths.rotation` exists and is
 * rendered, but 006 excludes on the un-rotated `box(...)`, so a rotated booth
 * collides by its axis-aligned box in Postgres. Modelling an oriented box here
 * would make the client stricter than the database, which is the one direction a
 * pre-check must never be: it would refuse a placement the server accepts.
 */
export function overlaps(a: Placement, b: Placement): boolean {
  if (a.floor_level !== b.floor_level) return false
  const ax2 = a.position_x + a.size_width - EPSILON
  const ay2 = a.position_y + a.size_height - EPSILON
  const bx2 = b.position_x + b.size_width - EPSILON
  const by2 = b.position_y + b.size_height - EPSILON
  return (
    a.position_x + EPSILON <= bx2 &&
    b.position_x + EPSILON <= ax2 &&
    a.position_y + EPSILON <= by2 &&
    b.position_y + EPSILON <= ay2
  )
}

/**
 * Every booth in `others` that the candidate would sit on top of.
 *
 * Self-comparison is skipped by `id`, so this is safe to call while dragging a
 * booth that is already in the list.
 */
export function findCollisions<T extends Placeable>(
  candidate: Partial<Placeable>,
  others: readonly T[],
): T[] {
  const box = placement(candidate)
  if (!box) return []
  const hits: T[] = []
  for (const other of others) {
    if (other.id === candidate.id) continue
    const otherBox = placement(other)
    if (otherBox && overlaps(box, otherBox)) hits.push(other)
  }
  return hits
}

/** Snap one coordinate to the grid. */
export function snap(value: number, grid: number = GRID): number {
  return round2(Math.round(value / grid) * grid)
}

/** Snap a point to the grid, clamped to the positive quadrant. */
export function snapToGrid(point: Point, grid: number = GRID): Point {
  return { x: Math.max(0, snap(point.x, grid)), y: Math.max(0, snap(point.y, grid)) }
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
  /** Ready for `<svg viewBox={…}>`. */
  value: string
}

/**
 * The camera: the bounding box of every placed booth, plus padding.
 *
 * Both screens call this, which is why panning and zooming agree between them.
 * An empty floor still returns a usable canvas so the editor has somewhere to
 * drop the first booth.
 */
export function toSvgViewBox(booths: readonly Placeable[], padding = 2): ViewBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const booth of booths) {
    const box = placement(booth)
    if (!box) continue
    minX = Math.min(minX, box.position_x)
    minY = Math.min(minY, box.position_y)
    maxX = Math.max(maxX, box.position_x + box.size_width)
    maxY = Math.max(maxY, box.position_y + box.size_height)
  }

  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 20, height: 12, value: '0 0 20 12' }

  const x = round2(minX - padding)
  const y = round2(minY - padding)
  const width = round2(Math.max(maxX - minX + padding * 2, 1))
  const height = round2(Math.max(maxY - minY + padding * 2, 1))
  return { x, y, width, height, value: `${x} ${y} ${width} ${height}` }
}

// ---------------------------------------------------------------------------
// Export / import
//
// A plan file is LAYOUT ONLY. `circle_id` is deliberately not exported: who sits
// where is an allocation decision the database arbitrates through
// `one_booth_per_circle`, and a JSON file that could reassign circles is both a
// privacy leak (it names who was accepted) and a way to smuggle a double
// allocation past the editor. Import moves walls; it never moves people.
// ---------------------------------------------------------------------------

const nullableNumber = z.number().finite().nullable()

const boothSchema = z.object({
  booth_number: z.string().min(1).max(20),
  booth_type: z.string().min(1),
  position_x: nullableNumber,
  position_y: nullableNumber,
  size_width: nullableNumber,
  size_height: nullableNumber,
  floor_level: z.number().int(),
  rotation: z.number().finite(),
  zone: z.string().nullable(),
  label: z.string().nullable(),
})

const planSchema = z.object({
  /** Bump when the shape changes; `importPlan` refuses a version it cannot read. */
  version: z.literal(1),
  exported_at: z.string(),
  booths: z.array(boothSchema),
})

export type FloorPlanBooth = z.infer<typeof boothSchema>
export type FloorPlanFile = z.infer<typeof planSchema>

export function exportPlan(
  booths: readonly BoothRow[],
  exportedAt = new Date().toISOString(),
): FloorPlanFile {
  return {
    version: 1,
    exported_at: exportedAt,
    booths: booths.map((b) => ({
      booth_number: b.booth_number,
      booth_type: b.booth_type,
      position_x: b.position_x,
      position_y: b.position_y,
      size_width: b.size_width,
      size_height: b.size_height,
      floor_level: b.floor_level,
      rotation: b.rotation,
      zone: b.zone,
      label: b.label,
    })),
  }
}

/**
 * Parse a plan file. A trust boundary — this is a file the user picked off their
 * disk — so it is validated, not cast. Throws with a message a human can act on.
 */
export function importPlan(input: unknown): FloorPlanFile {
  let value = input
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      throw new Error('That file is not JSON.')
    }
  }
  const parsed = planSchema.safeParse(value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(
      `Not a DoujinDesk floor plan: ${issue.path.join('.') || 'file'} — ${issue.message}`,
    )
  }
  return parsed.data
}

/**
 * The next free booth number in a zone row: `A-01`, `A-02`, … Collisions with
 * `UNIQUE(event_id, booth_number)` are still possible under a concurrent editor;
 * the insert surfaces 23505 and the organizer picks again.
 */
export function nextBoothNumber(booths: readonly BoothRow[], prefix = 'A'): string {
  const used = new Set(booths.map((b) => b.booth_number))
  for (let n = 1; n <= 999; n++) {
    const candidate = `${prefix}-${String(n).padStart(2, '0')}`
    if (!used.has(candidate)) return candidate
  }
  return `${prefix}-${Date.now().toString().slice(-4)}`
}

/** Distinct floors present in the data, ascending. Never a hardcoded list. */
export function floorsOf(booths: readonly Placeable[]): number[] {
  return [...new Set(booths.map((b) => b.floor_level))].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Status presentation
//
// Here rather than in either component, for the same reason the geometry is:
// the editor's legend and the attendee map must not disagree about what amber
// means. Values are Tailwind utilities over the tokens in src/index.css, so dark
// mode follows without a second table.
// ---------------------------------------------------------------------------

export interface StatusStyle {
  /** SVG rect classes. */
  shape: string
  /** Badge variant from src/components/ui/badge.tsx. */
  badge: 'success' | 'warning' | 'info' | 'danger' | 'secondary'
  /** i18n key under the `floorplan` namespace. */
  labelKey: `status.${BoothStatus}`
}

export const BOOTH_STATUS: Record<BoothStatus, StatusStyle> = {
  available: {
    shape: 'fill-success/15 stroke-success',
    badge: 'success',
    labelKey: 'status.available',
  },
  occupied: {
    shape: 'fill-info/20 stroke-info',
    badge: 'info',
    labelKey: 'status.occupied',
  },
  reserved: {
    shape: 'fill-warning/20 stroke-warning',
    badge: 'warning',
    labelKey: 'status.reserved',
  },
  maintenance: {
    shape: 'fill-muted stroke-border',
    badge: 'secondary',
    labelKey: 'status.maintenance',
  },
}

export const BOOTH_STATUSES = Object.keys(BOOTH_STATUS) as BoothStatus[]
