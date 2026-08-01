/**
 * The eight success criteria, as assertions rather than claims.
 *
 * This file exists for the gaps the per-package suites cannot cover, because
 * they are properties of the repository rather than of one module:
 *
 *   - criterion 1: no mock identifier survives in shipped source, and the
 *     pre-rebuild `persist` keys are actually removed from a real localStorage
 *     rather than merely deleted from source (a browser that ran the old build
 *     rehydrates them forever otherwise).
 *   - criterion 2: every navigable path has a route. A nav entry pointing at a
 *     path the router does not define renders the 404 page to the one role that
 *     lands there on sign-in, which is exactly how `/tasks` and `/wallet` were
 *     wrong before this package.
 *   - criterion 5: the token gate holds with an empty baseline. The eslint rule
 *     is the real gate; this is the tripwire that fires if the baseline array
 *     is ever refilled to make a screen "pass".
 *   - criterion 8: every repo path the README names exists.
 *
 * Everything else is covered where it belongs: scanQueue.test.ts (3),
 * money.test.ts + ledger.test.ts (4), floorplan.test.ts (booth conflict),
 * RequireRole.test.tsx (guard redirect), CircleApplicationForm.test.tsx
 * (application submit), tokens.test.ts (AA contrast), i18n.test.ts (key parity).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { matchPath } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_NAV, APP_NAV, PUBLIC_NAV, homeForRole } from '@/components/layout/nav'

const ROOT = join(__dirname, '..', '..')
const SRC = join(ROOT, 'src')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

const ALL_SOURCES = walk(SRC)
const isTest = (file: string) => /\.test\.tsx?$/.test(file)
/** Fixtures are the one legal home for invented data — that is what a demo is. */
const isFixture = (file: string) =>
  file.includes(`${join('lib', 'fixtures')}`) || file.includes(`${join('lib', 'demo')}`)

const shipped = ALL_SOURCES.filter((f) => !isTest(f))
const read = (file: string) => readFileSync(file, 'utf8')
const rel = (file: string) => relative(ROOT, file).replace(/\\/g, '/')

describe('criterion 1 — no mock data reaches a rendered screen', () => {
  it('no shipped source file names a mock', () => {
    const offenders = shipped
      .filter((f) => /\bMock|mockUser|mock-session\b/.test(read(f)))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('no shipped source carries the pre-rebuild fake literals', () => {
    const banned = /Comic Frontier 18|Sakura Studios|2500000000|lorem ipsum|trae-api-sg/i
    const offenders = shipped.filter((f) => !isFixture(f) && banned.test(read(f))).map(rel)
    expect(offenders).toEqual([])
  })

  it('boot removes the legacy Zustand persist keys from a live localStorage', async () => {
    // Deleting the mock arrays from source is not enough: the old build wrote
    // them to localStorage with no `version` and no `migrate`, so the owner's
    // own tab rehydrates Sakura Studios forever. This asserts the cleanup in
    // src/main.tsx reaches an existing browser.
    const legacy = [
      'circle-store',
      'ticket-store',
      'financial-store',
      'doujindesk-staff-store',
      'event-store',
    ]
    for (const key of legacy) localStorage.setItem(key, '{"state":{"circles":[]},"version":0}')

    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    await import('../main')

    expect(legacy.filter((key) => localStorage.getItem(key) !== null)).toEqual([])
    // 30s: importing main.tsx pulls the whole app graph through the transform
    // pipeline, which is slow when the rest of the suite is running beside it.
  }, 30_000)
})

describe('criterion 2 — every navigable path has a route', () => {
  // The route table is read as source rather than rendered: a router render
  // would need every screen's providers, and the property under test is the
  // path strings, not what they mount.
  const appSource = read(join(SRC, 'App.tsx'))
  const routePatterns = [...appSource.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1])

  const navPaths = [
    ...APP_NAV.flatMap((group) => group.items.map((i) => i.path)),
    ...PUBLIC_NAV.map((i) => i.path),
    ...ACCOUNT_NAV.map((i) => i.path),
    ...(['organizer', 'staff', 'circle', 'attendee'] as const).map(homeForRole),
  ]

  it('the router defines a route for every nav destination', () => {
    const concrete = (pattern: string) => pattern.replace(':eventId', 'e')
    const unrouted = [...new Set(navPaths)].filter(
      (path) =>
        !routePatterns.some((pattern) =>
          matchPath({ path: pattern, end: true }, concrete(path)),
        ),
    )
    expect(unrouted).toEqual([])
  })

  it('every route element is a component that exists', () => {
    const elements = [...appSource.matchAll(/element=\{<(\w+)\s*\/>\}/g)].map((m) => m[1])
    const missing = elements.filter(
      (name) => !new RegExp(`(import ${name} from|function ${name}\\b)`).test(appSource),
    )
    expect(missing).toEqual([])
  })
})

describe('criterion 5 — every colour traces to a token', () => {
  const PALETTE =
    /(?:bg|text|border|ring|from|to|via|fill|stroke|divide)-(?:gray|slate|zinc|neutral|stone|blue|indigo|purple|violet|green|emerald|teal|cyan|sky|red|rose|pink|fuchsia|orange|amber|yellow|lime)-\d/

  it('no .tsx file uses a raw palette class, a gradient or a hex literal', () => {
    const offenders = ALL_SOURCES.filter((f) => f.endsWith('.tsx'))
      .filter((f) => {
        const source = read(f)
        return (
          PALETTE.test(source) ||
          source.includes('bg-gradient-to-') ||
          /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(source)
        )
      })
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('the eslint token-gate baseline is empty', () => {
    // A non-empty baseline means a screen was exempted rather than migrated.
    const config = read(join(ROOT, 'eslint.config.js'))
    const baseline = config.match(/const TOKEN_GATE_BASELINE = \[([\s\S]*?)\]/)?.[1] ?? 'MISSING'
    expect(baseline.replace(/\s/g, '')).toBe('')
  })
})

describe('criterion 8 — the README describes the code', () => {
  it('every repo path the README names exists', () => {
    const readme = read(join(ROOT, 'README.md'))
    const paths = [...readme.matchAll(/`((?:src|supabase|api|public)\/[\w./:*-]+)`/g)]
      .map((m) => m[1])
      .filter((p) => !p.includes('*') && !p.endsWith('/'))
    expect(paths.length).toBeGreaterThan(5)

    const missing = [...new Set(paths)].filter((p) => {
      try {
        readFileSync(join(ROOT, p))
        return false
      } catch {
        try {
          readdirSync(join(ROOT, p))
          return false
        } catch {
          return true
        }
      }
    })
    expect(missing).toEqual([])
  })
})
