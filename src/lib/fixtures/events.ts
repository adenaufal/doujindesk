import type { EventRow, EventCounterRow, EventPricingRow, ProfileRow } from '../database.types'
import { EVENT_ID, EVENT_ID_TOKYO, USER, iso, uid } from './ids'

export const profiles: ProfileRow[] = [
  {
    id: USER.organizer,
    email: 'rina@comicfrontier.id',
    display_name: 'Rina Hapsari',
    avatar_url: null,
    role: 'organizer',
    locale: 'id',
    notification_prefs: {},
    created_at: iso(-120),
    updated_at: iso(-120),
  },
  {
    id: USER.staff,
    email: 'gate3@comicfrontier.id',
    display_name: 'Bagas Prakoso',
    avatar_url: null,
    role: 'staff',
    locale: 'id',
    notification_prefs: {},
    created_at: iso(-40),
    updated_at: iso(-40),
  },
  {
    id: USER.circle,
    email: 'kopisusu.studio@gmail.com',
    display_name: 'Kopi Susu Studio',
    avatar_url: null,
    role: 'circle',
    locale: 'id',
    notification_prefs: {},
    created_at: iso(-60),
    updated_at: iso(-60),
  },
  {
    id: USER.circle2,
    email: 'nekomachido@example.jp',
    display_name: '猫町堂',
    avatar_url: null,
    role: 'circle',
    locale: 'ja',
    notification_prefs: {},
    created_at: iso(-58),
    updated_at: iso(-58),
  },
  {
    id: USER.attendee,
    email: 'dimas.a@example.com',
    display_name: 'Dimas Aditya',
    avatar_url: null,
    role: 'attendee',
    locale: 'en',
    notification_prefs: {},
    created_at: iso(-14),
    updated_at: iso(-14),
  },
]

export const events: EventRow[] = [
  {
    id: EVENT_ID,
    name: 'Comic Frontier 19',
    description:
      'Dua hari doujin, fan art, dan merchandise buatan kreator lokal di ICE BSD City. Pintu buka 09.00.',
    start_date: iso(0, 9),
    end_date: iso(1, 18),
    venue_name: 'ICE BSD City, Hall 5-6',
    venue_address: 'Jl. BSD Grand Boulevard, Pagedangan, Tangerang, Banten 15339',
    max_circles: 900,
    max_attendees: 24_000,
    registration_start: iso(-70, 10),
    registration_end: iso(-7, 23),
    status: 'ongoing',
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
    floor_plan: { width: 60, height: 40, grid: 1, unit: 'm' },
    created_at: iso(-120),
    updated_at: iso(-3),
    created_by: USER.organizer,
  },
  {
    id: EVENT_ID_TOKYO,
    name: 'Doujin Matsuri Tokyo — Spring',
    description:
      '同人誌即売会。東京ビッグサイト東4ホール。一般入場は 11:00 から。Bilingual JP/EN catalogue.',
    start_date: iso(64, 11),
    end_date: iso(64, 16),
    venue_name: '東京ビッグサイト 東4ホール',
    venue_address: '東京都江東区有明3-11-1',
    max_circles: 1200,
    max_attendees: 30_000,
    registration_start: iso(-10, 10),
    registration_end: iso(30, 23),
    status: 'registration_open',
    currency: 'USD',
    timezone: 'Asia/Tokyo',
    floor_plan: { width: 80, height: 50, grid: 1, unit: 'm' },
    created_at: iso(-30),
    updated_at: iso(-2),
    created_by: USER.organizer,
  },
]

/** What `circles_set_total_amount` prices an application from. */
export const event_pricing: EventPricingRow[] = (
  [
    ['circle_space_1', 450_000],
    ['circle_space_2', 675_000],
    ['circle_space_4', 1_200_000],
    ['circle_booth_a', 2_500_000],
    ['circle_booth_b', 4_000_000],
  ] as const
).map(([space_type, price], i) => ({
  id: uid('7', i + 1),
  event_id: EVENT_ID,
  space_type,
  price,
  addon_table_price: 75_000,
  addon_chair_price: 35_000,
  addon_power_price: 150_000,
  extra_pass_price: 60_000,
  currency: 'IDR' as const,
  created_at: iso(-70),
  updated_at: iso(-70),
}))

/** Written only by trigger in Postgres; the demo scanner RPC bumps it the same way. */
export const event_counters: EventCounterRow[] = [
  { event_id: EVENT_ID, admitted_count: 1_842, queue_total: 260, updated_at: iso(0, 11) },
  { event_id: EVENT_ID_TOKYO, admitted_count: 0, queue_total: 0, updated_at: iso(-2) },
]
