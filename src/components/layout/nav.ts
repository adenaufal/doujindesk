import { matchPath } from 'react-router-dom'
import {
  Banknote,
  BookOpen,
  CalendarDays,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Map,
  Megaphone,
  ScanLine,
  Ticket,
  Users,
  UserCog,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import type { AppRole } from '@/stores/authStore'

// -----------------------------------------------------------------------------
// One nav table, filtered by role, shared by the sidebar, the mobile drawer, the
// public topbar and the footer. The old Footer offered Financial, Staff and
// Booths to anonymous attendees; a single role-aware source is why that cannot
// happen again.
//
// `:eventId` in the URL is the source of truth for event scope. Paths are stored
// as route patterns and resolved against the id from `useParams` — nothing here
// caches an event id that could drift from the address bar.
// -----------------------------------------------------------------------------

export interface NavItem {
  /** Fully-qualified i18n key, e.g. `common:nav.dashboard`. */
  labelKey: string
  icon: LucideIcon
  /** Route pattern. May contain `:eventId`. */
  path: string
  roles: readonly AppRole[]
  /** Match the path exactly (for the `/e/:eventId` index route). */
  end?: boolean
}

export type NavGroupKey = 'event' | 'operations' | 'money'

export interface NavGroup {
  key: NavGroupKey
  items: NavItem[]
}

const ALL = ['organizer', 'staff', 'circle', 'attendee'] as const
const OPS = ['organizer', 'staff'] as const

/** Sidebar navigation for the App layout (organizer + staff). */
export const APP_NAV: NavGroup[] = [
  {
    key: 'event',
    items: [
      {
        labelKey: 'common:nav.dashboard',
        icon: LayoutDashboard,
        path: '/e/:eventId/dashboard',
        roles: ['organizer'],
      },
      {
        labelKey: 'common:nav.circles',
        icon: Users,
        path: '/e/:eventId/circles',
        roles: ['organizer'],
      },
      {
        labelKey: 'common:nav.booths',
        icon: LayoutGrid,
        path: '/e/:eventId/booths',
        roles: ['organizer'],
      },
      {
        labelKey: 'common:nav.tickets',
        icon: Ticket,
        path: '/e/:eventId/tickets',
        roles: ['organizer'],
      },
      {
        labelKey: 'common:nav.schedule',
        icon: CalendarDays,
        path: '/e/:eventId/schedule',
        roles: OPS,
      },
    ],
  },
  {
    key: 'operations',
    items: [
      { labelKey: 'common:nav.scanner', icon: ScanLine, path: '/e/:eventId/scan', roles: OPS },
      { labelKey: 'shell:nav.queue', icon: ListChecks, path: '/e/:eventId/queue', roles: OPS },
      { labelKey: 'shell:nav.tasks', icon: ListChecks, path: '/tasks', roles: OPS },
      {
        labelKey: 'common:nav.staff',
        icon: UserCog,
        path: '/e/:eventId/staff',
        roles: ['organizer'],
      },
      {
        labelKey: 'common:nav.announcements',
        icon: Megaphone,
        path: '/e/:eventId/announcements',
        roles: ['organizer'],
      },
    ],
  },
  {
    key: 'money',
    items: [
      {
        labelKey: 'common:nav.finance',
        icon: Banknote,
        path: '/e/:eventId/financial',
        roles: ['organizer'],
      },
    ],
  },
]

/** Topbar + footer navigation for the Public layout. Event-scoped, all roles. */
export const PUBLIC_NAV: NavItem[] = [
  { labelKey: 'common:nav.guide', icon: BookOpen, path: '/e/:eventId', roles: ALL, end: true },
  { labelKey: 'common:nav.catalog', icon: Users, path: '/e/:eventId/catalog', roles: ALL },
  { labelKey: 'common:nav.map', icon: Map, path: '/e/:eventId/map', roles: ALL },
  { labelKey: 'common:nav.schedule', icon: CalendarDays, path: '/e/:eventId/schedule', roles: ALL },
  { labelKey: 'common:nav.tickets', icon: Ticket, path: '/e/:eventId/tickets', roles: ALL },
]

/** Signed-in, non-admin destinations. Rendered next to PUBLIC_NAV. */
export const ACCOUNT_NAV: NavItem[] = [
  { labelKey: 'common:nav.myTickets', icon: Wallet, path: '/wallet', roles: ['attendee'] },
  {
    labelKey: 'common:nav.myApplication',
    icon: FileText,
    path: '/e/:eventId/apply',
    roles: ['circle'],
  },
]

/** Replace `:eventId`, or return null when the item needs an event and none is in scope. */
export function resolvePath(path: string, eventId?: string): string | null {
  if (!path.includes(':eventId')) return path
  return eventId ? path.replace(':eventId', eventId) : null
}

export interface ResolvedNavItem extends NavItem {
  to: string
}

export function visibleItems(
  items: readonly NavItem[],
  role: AppRole | null,
  eventId?: string
): ResolvedNavItem[] {
  const out: ResolvedNavItem[] = []
  for (const item of items) {
    if (role && !item.roles.includes(role)) continue
    if (!role && item.roles.length !== ALL.length) continue
    const to = resolvePath(item.path, eventId)
    if (to) out.push({ ...item, to })
  }
  return out
}

export function appNavFor(
  role: AppRole | null,
  eventId?: string
): { key: NavGroupKey; items: ResolvedNavItem[] }[] {
  return APP_NAV.map((group) => ({
    key: group.key,
    items: visibleItems(group.items, role, eventId),
  })).filter((group) => group.items.length > 0)
}

/** Which sidebar entry the current URL belongs to — the breadcrumb reads this. */
export function findAppNavItem(pathname: string): { group: NavGroupKey; item: NavItem } | null {
  for (const group of APP_NAV) {
    for (const item of group.items) {
      if (matchPath({ path: item.path, end: item.end ?? false }, pathname)) {
        return { group: group.key, item }
      }
    }
  }
  return null
}

/**
 * Where a role lands when it has no better destination — after sign-in without a
 * `next`, and when a guard rejects an authenticated user.
 *
 * Organizer and circle land on `/`, which is the event chooser: every organizer
 * screen is `/e/:eventId/…` and there is no way to pick an id without asking the
 * server which events exist. `/` is public, so none of these can loop.
 */
export function homeForRole(role: AppRole | null): string {
  switch (role) {
    case 'attendee':
      return '/wallet'
    case 'staff':
      return '/tasks'
    default:
      return '/'
  }
}
