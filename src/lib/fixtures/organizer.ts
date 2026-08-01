import type { NotificationRow } from '../database.types'
import { EVENT_ID, USER, iso, uid } from './ids'

/**
 * The organizer's own inbox.
 *
 * `operations.ts` seeds notifications for the circle, attendee and staff
 * accounts; without these the demo role picker's *first* account lands on an
 * empty NotificationCenter and an empty dashboard feed, which teaches the owner
 * nothing about whether either screen works. Everything else the organizer
 * screens need — roster, tasks, queues, announcements, ledger — is already
 * seeded there and in `transactions.ts`.
 */
export const organizer_notifications: NotificationRow[] = [
  {
    id: uid('0', 11),
    user_id: USER.organizer,
    event_id: EVENT_ID,
    category: 'application',
    title: {
      en: '3 applications waiting',
      ja: '審査待ちの申込が3件',
      id: '3 pendaftaran menunggu',
    },
    body: {
      en: 'Hujan Tinta, 亜細亜組 and one more have been waiting more than 48 hours.',
      ja: 'Hujan Tinta・亜細亜組ほか1件が48時間以上未審査です。',
      id: 'Hujan Tinta, 亜細亜組, dan satu lagi sudah menunggu lebih dari 48 jam.',
    },
    data: {},
    announcement_id: null,
    read_at: null,
    archived_at: null,
    created_at: iso(0, 8),
    updated_at: iso(0, 8),
  },
  {
    id: uid('0', 12),
    user_id: USER.organizer,
    event_id: EVENT_ID,
    category: 'payment',
    title: { en: 'Refund posted', ja: '返金を計上しました', id: 'Refund dibukukan' },
    body: {
      en: 'Rp 2.500.000 reversed for Warung Doujin — application rejected.',
      ja: 'Warung Doujin の落選に伴い Rp 2.500.000 を返金処理しました。',
      id: 'Rp 2.500.000 dikembalikan untuk Warung Doujin — pendaftaran ditolak.',
    },
    data: {},
    announcement_id: null,
    read_at: null,
    archived_at: null,
    created_at: iso(-12, 14),
    updated_at: iso(-12, 14),
  },
  {
    id: uid('0', 13),
    user_id: USER.organizer,
    event_id: EVENT_ID,
    category: 'system',
    title: {
      en: 'Gate 3 queue over 80% capacity',
      ja: 'ゲート3の待機列が収容率80%超',
      id: 'Antrean Gate 3 di atas 80% kapasitas',
    },
    body: {
      en: '184 people waiting against a 600 capacity lane, 22 minute wait.',
      ja: '収容600に対し184人が待機、待ち時間22分です。',
      id: '184 orang menunggu di jalur berkapasitas 600, waktu tunggu 22 menit.',
    },
    data: {},
    announcement_id: null,
    read_at: iso(0, 11),
    archived_at: null,
    created_at: iso(0, 11),
    updated_at: iso(0, 11),
  },
  {
    id: uid('0', 14),
    user_id: USER.organizer,
    event_id: EVENT_ID,
    category: 'booth',
    title: { en: 'Booth A-04 freed up', ja: 'スペース A-04 が空きました', id: 'Booth A-04 kosong' },
    body: {
      en: 'Warung Doujin was rejected, so A-04 is available for the waitlist.',
      ja: 'Warung Doujin が落選したため、A-04 は補欠に回せます。',
      id: 'Warung Doujin ditolak, jadi A-04 bisa dialihkan ke waitlist.',
    },
    data: {},
    announcement_id: null,
    read_at: iso(-11, 9),
    archived_at: null,
    created_at: iso(-12, 15),
    updated_at: iso(-11, 9),
  },
]
