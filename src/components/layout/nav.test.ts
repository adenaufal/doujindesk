import { beforeAll, describe, expect, it } from 'vitest'

import i18n, { i18nReady } from '@/lib/i18n'
import {
  ACCOUNT_NAV,
  APP_NAV,
  PUBLIC_NAV,
  appNavFor,
  findAppNavItem,
  homeForRole,
  visibleItems,
} from './nav'

const ALL_ITEMS = [...APP_NAV.flatMap((group) => group.items), ...PUBLIC_NAV, ...ACCOUNT_NAV]

describe('nav table', () => {
  beforeAll(async () => {
    await i18nReady
  })

  it('resolves every label, including the keys in the shell namespace', () => {
    for (const item of ALL_ITEMS) {
      // i18next echoes the key back (minus the namespace prefix) when it is
      // missing, which is exactly how a typo'd namespace ships to production.
      const fallback = item.labelKey.split(':').pop()
      expect(i18n.t(item.labelKey), item.labelKey).not.toBe(fallback)
    }
  })

  it('drops event-scoped items when there is no event in the URL', () => {
    const groups = appNavFor('staff')
    const paths = groups.flatMap((group) => group.items.map((item) => item.to))

    expect(paths).toEqual(['/tasks'])
  })

  it('resolves :eventId from the URL and never leaks the pattern', () => {
    const paths = appNavFor('organizer', 'evt-1').flatMap((group) =>
      group.items.map((item) => item.to)
    )

    expect(paths).toContain('/e/evt-1/dashboard')
    expect(paths).toContain('/e/evt-1/financial')
    expect(paths.some((path) => path.includes(':eventId'))).toBe(false)
  })

  it('never offers an admin screen to a circle or an attendee', () => {
    for (const role of ['circle', 'attendee'] as const) {
      expect(appNavFor(role, 'evt-1')).toEqual([])
    }
    // …and the public/anonymous nav never contains one either.
    const publicPaths = visibleItems(PUBLIC_NAV, null, 'evt-1').map((item) => item.to)
    expect(publicPaths).not.toContain('/e/evt-1/financial')
  })

  it('maps a URL back to its breadcrumb', () => {
    expect(findAppNavItem('/e/evt-1/circles')?.group).toBe('event')
    expect(findAppNavItem('/e/evt-1/financial')?.group).toBe('money')
    expect(findAppNavItem('/nowhere')).toBeNull()
  })

  it('sends every role somewhere public or role-owned, never into a guard loop', () => {
    expect(homeForRole('attendee')).toBe('/wallet')
    expect(homeForRole('staff')).toBe('/tasks')
    expect(homeForRole('organizer')).toBe('/')
    expect(homeForRole(null)).toBe('/')
  })
})
