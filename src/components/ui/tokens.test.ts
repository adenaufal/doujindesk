import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The token contract in src/index.css claims WCAG 2.1 AA contrast on every
 * surface/foreground pair, in both themes. Claims in a comment rot; this asserts
 * them. It is the only thing standing between "we changed one lightness value"
 * and an unreadable status pill at a convention door.
 */

// import.meta.url is an http:// URL under the jsdom environment, so resolve
// from the vitest root instead.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function parseBlock(start: number, end: number): Record<string, string> {
  const out: Record<string, string> = {}
  const slice = css.slice(start, end)
  for (const m of slice.matchAll(/--([\w-]+):\s*([\d.]+ [\d.]+% [\d.]+%);/g)) {
    out[m[1]] = m[2]
  }
  return out
}

const darkAt = css.indexOf('.dark {')
const light = parseBlock(css.indexOf(':root {'), darkAt)
const dark = parseBlock(darkAt, css.length)

function toRgb(triplet: string): [number, number, number] {
  const [h, s, l] = triplet.split(' ').map(parseFloat)
  const sN = s / 100
  const lN = l / 100
  const a = sN * Math.min(lN, 1 - lN)
  const k = (n: number) => (n + h / 30) % 12
  const f = (n: number) =>
    lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as [number, number, number]
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(tokens: Record<string, string>, a: string, b: string): number {
  expect(tokens[a], `token --${a} is missing`).toBeDefined()
  expect(tokens[b], `token --${b} is missing`).toBeDefined()
  const l1 = luminance(toRgb(tokens[a]))
  const l2 = luminance(toRgb(tokens[b]))
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** Surfaces whose -foreground is rendered as text on top of them. */
const SOLID_PAIRS = [
  'primary',
  'secondary',
  'destructive',
  'success',
  'warning',
  'info',
  'card',
  'popover',
  'muted',
  'accent',
  'sidebar-primary',
  'sidebar-accent',
]

/** Status hues rendered as text on their own tinted surface. */
const SUBTLE_HUES = ['success', 'warning', 'info', 'destructive']

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (themeName, tokens) => {
  it.each(SOLID_PAIRS)('%s / %s-foreground clears 4.5:1', (key) => {
    expect(contrast(tokens, `${key}-foreground`, key)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(SUBTLE_HUES)('%s reads on %s-subtle at 4.5:1', (key) => {
    expect(contrast(tokens, key, `${key}-subtle`)).toBeGreaterThanOrEqual(4.5)
  })

  it('body and muted text clear 4.5:1 on the page background', () => {
    expect(contrast(tokens, 'foreground', 'background')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens, 'muted-foreground', 'background')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens, 'primary', 'background')).toBeGreaterThanOrEqual(4.5)
  })

  it('sidebar text clears 4.5:1 on the sidebar surface', () => {
    expect(contrast(tokens, 'sidebar-foreground', 'sidebar')).toBeGreaterThanOrEqual(4.5)
  })

  it('the focus ring clears the 3:1 non-text threshold', () => {
    expect(contrast(tokens, 'ring', 'background')).toBeGreaterThanOrEqual(3)
  })

  it(`--destructive is not --primary (${themeName})`, () => {
    // These were byte-identical before this package: Reject and Submit were the
    // same pixel.
    expect(tokens.destructive).not.toBe(tokens.primary)
  })
})

describe('token source of truth', () => {
  it('defines each token exactly once, in HSL, with no Tailwind v4 @theme block', () => {
    // A second :root or an @layer base redefinition means the winning value is
    // decided by source order, which is how this file previously shipped every
    // token twice — once as HSL, once as raw hex.
    expect(css.match(/:root\s*\{/g)).toHaveLength(1)
    expect(css).not.toContain('@theme')
    expect(css).not.toMatch(/--(background|primary|destructive):\s*#/)
  })
})
