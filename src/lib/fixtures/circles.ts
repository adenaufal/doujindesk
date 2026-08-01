import type { BoothRow, CircleRow } from '../database.types'
import { EVENT_ID, USER, iso, uid } from './ids'

type Seed = {
  n: number
  code: string | null
  name: string
  furigana: string | null
  pen: string
  status: CircleRow['application_status']
  paid?: boolean
  genre: string
  fandom: string | null
  rating: CircleRow['rating']
  space: CircleRow['space_type']
  amount: number
  blurb: string
  owner?: string
  waitlist?: number
  notes?: string
}

/**
 * Eight circles across every application state. Names are real-shaped: Indonesian
 * doujin circles skew Bahasa/English wordplay, Japanese ones are 2-4 kanji with a
 * kana reading. A queue full of "Test Circle 1" tells the organizer nothing about
 * whether the review UI holds a long name or a kana sort.
 */
const seeds: Seed[] = [
  {
    n: 1,
    code: 'A-01',
    name: 'Kopi Susu Studio',
    furigana: null,
    pen: 'Naya',
    status: 'accepted',
    paid: true,
    genre: 'Original / Slice of life',
    fandom: null,
    rating: 'all_ages',
    space: 'circle_space_2',
    amount: 675_000,
    blurb:
      'Komik pendek tentang warung kopi di Bandung. Cetak riso dua warna, plus sticker sheet dan tote bag.',
    owner: USER.circle,
  },
  {
    n: 2,
    code: 'A-02',
    name: '猫町堂',
    furigana: 'ねこまちどう',
    pen: '灰谷 みお',
    status: 'accepted',
    paid: true,
    genre: '創作 / イラスト本',
    fandom: null,
    rating: 'r15',
    space: 'circle_space_1',
    amount: 450_000,
    blurb: '猫と路地裏のイラスト本。新刊はB5・36P、フルカラー表紙。ポストカードセットも頒布します。',
    owner: USER.circle2,
  },
  {
    n: 3,
    code: 'A-03',
    name: 'Hujan Tinta',
    furigana: null,
    pen: 'Fikri A.',
    status: 'accepted',
    paid: true,
    genre: 'Fanwork / Anthology',
    fandom: 'Genshin Impact',
    rating: 'r15',
    space: 'circle_space_1',
    amount: 450_000,
    blurb: 'Antologi 6 artis, tema hujan di Liyue. 80 halaman, softcover, terbatas 150 eksemplar.',
  },
  {
    n: 4,
    code: null,
    name: '渋谷スタジオ',
    furigana: 'しぶやすたじお',
    pen: '相沢 コウ',
    status: 'under_review',
    genre: '二次創作 / 漫画',
    fandom: '呪術廻戦',
    rating: 'r18',
    space: 'circle_space_2',
    amount: 675_000,
    blurb: '既刊5種と新刊1種。R18のため成人向けスペース希望、当日は年齢確認を実施します。',
    notes: 'Requests an R18-zoned space; check adjacency to the family aisle before allocating.',
  },
  {
    n: 5,
    code: null,
    name: 'Lentera Senja',
    furigana: null,
    pen: 'Ayu Ramadhani',
    status: 'submitted',
    genre: 'Original / Fantasy',
    fandom: null,
    rating: 'all_ages',
    space: 'circle_space_1',
    amount: 450_000,
    blurb: 'Novel grafis fantasi Nusantara, bab 1-3. Ilustrasi cat air, cetak A5 128 halaman.',
  },
  {
    n: 6,
    code: null,
    name: '亜細亜組',
    furigana: 'あじあぐみ',
    pen: '和田 リョウ',
    status: 'waitlisted',
    waitlist: 3,
    genre: '創作 / 評論',
    fandom: null,
    rating: 'all_ages',
    space: 'circle_space_1',
    amount: 450_000,
    blurb: 'アジア各国の同人文化を扱う評論誌。第4号はインドネシア特集、日英併記。',
    notes: 'Waitlist #3 — bump if a space-1 accepted circle withdraws.',
  },
  {
    n: 7,
    code: null,
    name: 'Warung Doujin',
    furigana: null,
    pen: 'Bimo S.',
    status: 'rejected',
    genre: 'Merchandise only',
    fandom: null,
    rating: 'all_ages',
    space: 'circle_booth_a',
    amount: 2_500_000,
    blurb: 'Reseller merchandise impor.',
    notes: 'Rejected: resale-only, no original work. Refund issued.',
  },
  {
    n: 8,
    code: null,
    name: 'Sanggar Pixel',
    furigana: null,
    pen: 'Tari',
    status: 'draft',
    genre: 'Original / Illustration',
    fandom: null,
    rating: 'all_ages',
    space: 'circle_space_1',
    amount: 450_000,
    blurb: 'Draf — belum dikirim.',
    owner: USER.circle,
  },
]

export const circles: CircleRow[] = seeds.map((s) => ({
  id: uid('c', s.n),
  event_id: EVENT_ID,
  circle_code: s.code,
  circle_name: s.name,
  circle_name_furigana: s.furigana,
  circle_name_sort_key: (s.furigana ?? s.name).toLowerCase(),
  pen_name: s.pen,
  pen_name_furigana: null,
  email: `circle${s.n}@example.com`,
  phone: '+62 812-0000-00' + String(s.n).padStart(2, '0'),
  address: null,
  postal_code: null,
  country: s.furigana ? 'JP' : 'ID',
  emergency_contact_name: null,
  emergency_contact_phone: null,
  co_rep_name: null,
  co_rep_email: null,
  co_rep_phone: null,
  circle_cut_file_url: null,
  sample_works_images: null,
  fandom: s.fandom,
  genre: s.genre,
  rating: s.rating,
  product_types: ['doujinshi', 'goods'],
  description: s.blurb,
  works_description: s.blurb,
  social_media_twitter: null,
  social_media_pixiv: null,
  social_media_website: null,
  social_media_instagram: null,
  marketplace_link: null,
  space_type: s.space,
  additional_table: s.n % 3 === 0,
  additional_chair: false,
  additional_power: s.n === 4,
  exhibitor_passes: s.space === 'circle_space_2' ? 3 : 2,
  previous_participation: s.n < 4,
  sells_commission: s.n === 2,
  commission_rate: s.n === 2 ? 10 : null,
  total_amount: s.amount,
  payment_status: s.paid ? 'paid' : s.status === 'rejected' ? 'refunded' : 'pending',
  application_status: s.status,
  booth_number: s.code,
  special_requests: null,
  notes: s.notes ?? null,
  submitted_at: s.status === 'draft' ? null : iso(-30 + s.n),
  reviewed_at: ['accepted', 'rejected', 'waitlisted'].includes(s.status) ? iso(-12 + s.n) : null,
  reviewed_by: ['accepted', 'rejected', 'waitlisted'].includes(s.status) ? USER.organizer : null,
  review_notes: s.notes ?? null,
  waitlist_position: s.waitlist ?? null,
  created_at: iso(-40 + s.n),
  updated_at: iso(-5 + s.n),
  user_id: s.owner ?? null,
}))

/**
 * A real aisle: 6 booths of 2×1 m along y=4, then a second row at y=10, so the
 * SVG floor plan has geometry to draw and collisions to catch.
 */
export const booths: BoothRow[] = Array.from({ length: 12 }, (_, i) => {
  const row = i < 6 ? 'A' : 'B'
  const col = (i % 6) + 1
  const circle = circles[i]?.application_status === 'accepted' ? circles[i] : undefined
  return {
    id: uid('b', i + 1),
    event_id: EVENT_ID,
    booth_number: `${row}-${String(col).padStart(2, '0')}`,
    booth_type: 'circle_space_1',
    size_width: 2,
    size_height: 1,
    position_x: 4 + col * 3,
    position_y: i < 6 ? 4 : 10,
    floor_level: 1,
    zone: row === 'A' ? 'General' : 'R15+',
    status: circle ? 'occupied' : 'available',
    circle_id: circle?.id ?? null,
    rotation: 0,
    label: circle?.circle_name ?? null,
    created_at: iso(-20),
    updated_at: iso(-6),
  }
})
