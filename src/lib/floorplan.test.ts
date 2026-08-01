import { describe, expect, it } from 'vitest'

import type { BoothRow } from './database.types'
import {
  BOOTH_STATUS,
  EPSILON,
  exportPlan,
  findCollisions,
  floorsOf,
  importPlan,
  nextBoothNumber,
  overlaps,
  placement,
  snapToGrid,
  toSvgViewBox,
  type Placement,
} from './floorplan'

// Criterion 7's "booth allocation conflict" test. Pure functions only — no DOM,
// no Supabase, no fixtures. If any of this needed a render to pass, the geometry
// would be living in a component, which is the drift this file guards against.

const at = (
  position_x: number,
  position_y: number,
  size_width = 2,
  size_height = 1,
  floor_level = 1,
): Placement => ({ position_x, position_y, size_width, size_height, floor_level })

let seq = 0
const booth = (over: Partial<BoothRow> = {}): BoothRow => ({
  id: `booth-${++seq}`,
  event_id: 'event-1',
  booth_number: `A-${String(seq).padStart(2, '0')}`,
  booth_type: 'circle_space_1',
  size_width: 2,
  size_height: 1,
  position_x: 0,
  position_y: 0,
  floor_level: 1,
  zone: 'General',
  status: 'available',
  circle_id: null,
  rotation: 0,
  label: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('overlaps', () => {
  it('is true when one booth sits on top of another', () => {
    expect(overlaps(at(0, 0), at(1, 0))).toBe(true)
  })

  it('is false for booths that merely touch along an edge', () => {
    // The reason 006 insets its boxes by 0.01: convention aisles are laid out
    // edge to edge, and `box && box` in Postgres counts touching as overlapping.
    expect(overlaps(at(0, 0), at(2, 0))).toBe(false)
    expect(overlaps(at(0, 0), at(0, 1))).toBe(false)
  })

  it('is false for booths that touch at a single corner', () => {
    expect(overlaps(at(0, 0), at(2, 1))).toBe(false)
  })

  it('is true for an intrusion of one grid step', () => {
    expect(overlaps(at(0, 0), at(1.5, 0))).toBe(true)
    expect(overlaps(at(0, 0), at(0, 0.5))).toBe(true)
  })

  it('accepts an intrusion of exactly EPSILON, exactly as the SQL constraint does', () => {
    // Not a bug and not a rounding accident: 006's 0.01 inset is what buys back
    // edge-to-edge layout, and it costs one representable unit of tolerance.
    // The client must never be stricter than the database — it would refuse a
    // placement the server would have taken.
    expect(overlaps(at(0, 0), at(2 - EPSILON, 0))).toBe(false)
    expect(overlaps(at(0, 0), at(2 - EPSILON * 2, 0))).toBe(true)
  })

  it('never collides across floors, however identical the coordinates', () => {
    expect(overlaps(at(0, 0, 2, 1, 1), at(0, 0, 2, 1, 2))).toBe(false)
    expect(overlaps(at(4, 4, 3, 3, 2), at(5, 5, 3, 3, 3))).toBe(false)
  })

  it('is symmetric', () => {
    const a = at(0, 0, 5, 5)
    const b = at(3, 3, 5, 5)
    expect(overlaps(a, b)).toBe(overlaps(b, a))
  })

  it('ignores rotation, because the exclusion constraint does', () => {
    // A rotated booth still collides by its axis-aligned box in Postgres.
    // Modelling an oriented box here would make the two disagree.
    const rotated = { ...booth({ rotation: 45, position_x: 1 }) }
    expect(findCollisions(rotated, [booth({ position_x: 0 })])).toHaveLength(1)
  })
})

describe('placement', () => {
  it('returns null for a booth that has not been placed on the canvas', () => {
    expect(placement(booth({ position_x: null }))).toBeNull()
    expect(placement(booth({ size_width: null }))).toBeNull()
  })

  it('keeps an unplaced booth out of collision results — NULL is exempt in 006 too', () => {
    const unplaced = booth({ position_x: null, position_y: null })
    expect(findCollisions(unplaced, [booth({ position_x: 0 })])).toEqual([])
    expect(findCollisions(booth({ position_x: 0 }), [unplaced])).toEqual([])
  })
})

describe('findCollisions', () => {
  it('never reports a booth colliding with itself', () => {
    const a = booth({ position_x: 0 })
    expect(findCollisions(a, [a])).toEqual([])
  })

  it('reports every booth hit, not just the first', () => {
    const target = booth({ position_x: 1, size_width: 6 })
    const hits = findCollisions(target, [
      booth({ position_x: 0 }),
      booth({ position_x: 3 }),
      booth({ position_x: 20 }),
      booth({ position_x: 3, floor_level: 2 }),
    ])
    expect(hits.map((b) => b.position_x)).toEqual([0, 3])
  })
})

describe('snapToGrid', () => {
  it('rounds to the nearest half metre', () => {
    expect(snapToGrid({ x: 1.2, y: 3.4 })).toEqual({ x: 1, y: 3.5 })
    expect(snapToGrid({ x: 1.26, y: 0.24 })).toEqual({ x: 1.5, y: 0 })
  })

  it('clamps to the positive quadrant — a booth outside the hall is not a plan', () => {
    expect(snapToGrid({ x: -3, y: -0.2 })).toEqual({ x: 0, y: 0 })
  })

  it('honours a custom grid', () => {
    expect(snapToGrid({ x: 1.4, y: 2.6 }, 1)).toEqual({ x: 1, y: 3 })
  })
})

describe('toSvgViewBox', () => {
  it('wraps every placed booth with padding', () => {
    const view = toSvgViewBox([
      booth({ position_x: 4, position_y: 4 }),
      booth({ position_x: 10, position_y: 8 }),
    ])
    expect(view).toMatchObject({ x: 2, y: 2, width: 12, height: 9 })
    expect(view.value).toBe('2 2 12 9')
  })

  it('returns a usable canvas for an empty floor', () => {
    expect(toSvgViewBox([]).width).toBeGreaterThan(0)
    expect(toSvgViewBox([booth({ position_x: null })]).height).toBeGreaterThan(0)
  })
})

describe('floorsOf', () => {
  it('derives floors from the data, sorted and deduplicated', () => {
    expect(floorsOf([booth({ floor_level: 2 }), booth(), booth({ floor_level: 2 })])).toEqual([
      1, 2,
    ])
  })
})

describe('exportPlan / importPlan', () => {
  const rows = [
    booth({ position_x: 4, position_y: 4, zone: 'General' }),
    booth({ position_x: 7, position_y: 4, floor_level: 2, rotation: 90, label: '猫町堂' }),
    booth({ position_x: null, position_y: null }),
  ]

  it('round-trips through JSON unchanged', () => {
    const exported = exportPlan(rows, '2026-08-01T00:00:00.000Z')
    expect(importPlan(JSON.stringify(exported))).toEqual(exported)
  })

  it('carries layout only — never circle_id, so an import cannot reassign a circle', () => {
    const exported = exportPlan([booth({ circle_id: 'circle-9', status: 'occupied' })])
    expect(JSON.stringify(exported)).not.toContain('circle-9')
    expect(exported.booths[0]).not.toHaveProperty('circle_id')
    expect(exported.booths[0]).not.toHaveProperty('status')
  })

  it('preserves unplaced booths as null coordinates', () => {
    const exported = exportPlan(rows)
    expect(exported.booths[2].position_x).toBeNull()
    expect(importPlan(exported).booths[2].position_y).toBeNull()
  })

  it('rejects a file that is not JSON', () => {
    expect(() => importPlan('not json {')).toThrow(/not JSON/i)
  })

  it('rejects a future plan version', () => {
    expect(() => importPlan({ version: 2, exported_at: '', booths: [] })).toThrow(/floor plan/i)
  })

  it('names the offending field when a booth is malformed', () => {
    const bad = { version: 1, exported_at: '', booths: [{ booth_number: 'A-01' }] }
    expect(() => importPlan(bad)).toThrow(/booths\.0\./)
  })
})

describe('nextBoothNumber', () => {
  it('fills the first gap in the zone', () => {
    const rows = [booth({ booth_number: 'A-01' }), booth({ booth_number: 'A-03' })]
    expect(nextBoothNumber(rows, 'A')).toBe('A-02')
    expect(nextBoothNumber(rows, 'B')).toBe('B-01')
  })
})

describe('BOOTH_STATUS', () => {
  it('covers exactly the four statuses the CHECK constraint permits', () => {
    // `assigned` and `blocked` are not among them — the pre-rebuild mock used
    // both, and every write of either would have been rejected by Postgres.
    expect(Object.keys(BOOTH_STATUS).sort()).toEqual([
      'available',
      'maintenance',
      'occupied',
      'reserved',
    ])
  })
})
