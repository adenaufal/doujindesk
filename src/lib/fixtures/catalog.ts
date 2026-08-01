/**
 * Attendee-surface fixtures (P13): the catalog needs enough accepted circles to
 * make facets and R18 gating real.
 *
 * `circles.ts` seeds eight circles across every *application state*, of which
 * only three are accepted — a correct review-queue demo and a thin catalog. These
 * eight are all accepted, carry booths on a third aisle (C), and spread genre,
 * fandom, rating and online-shop so every facet has more than one bucket and the
 * R18 cover actually appears.
 *
 * They are additive: `seedTables()` concatenates them onto the base arrays, and
 * the `circle_catalog` view derives from `circles` + `booths` exactly as the SQL
 * does, so nothing here is catalog-only data.
 */
import type { BoothRow, CircleRow, EventScheduleRow } from '../database.types'
import { EVENT_ID, iso, uid } from './ids'

type Seed = {
  n: number
  code: string
  name: string
  furigana: string | null
  pen: string
  genre: string
  fandom: string | null
  rating: NonNullable<CircleRow['rating']>
  products: string[]
  blurb: string
  works: string
  shop?: string
  twitter?: string
}

const seeds: Seed[] = [
  {
    n: 9,
    code: 'C-01',
    name: 'Kertas Basah',
    furigana: null,
    pen: 'Rizky Pratama',
    genre: 'Original / Comic essay',
    fandom: null,
    rating: 'all_ages',
    products: ['doujinshi', 'zine'],
    blurb: 'Komik esai tentang naik KRL tiap pagi selama sepuluh tahun.',
    works: 'Buku baru: "Gerbong 4" — 64 halaman, hitam putih, cetak digital A5.',
    twitter: 'kertasbasah',
  },
  {
    n: 10,
    code: 'C-02',
    name: '深夜零時',
    furigana: 'しんやれいじ',
    pen: '橘 ナオ',
    genre: '二次創作 / 漫画',
    fandom: '呪術廻戦',
    rating: 'r18',
    products: ['doujinshi'],
    blurb: '深夜の学校を舞台にした二次創作。成人向けのため年齢確認あり。',
    works: '新刊はB5・52P。既刊3種も少部数で持ち込みます。',
  },
  {
    n: 11,
    code: 'C-03',
    name: 'Nasi Padang Press',
    furigana: null,
    pen: 'Uda Rendang',
    genre: 'Fanzine / Food comics',
    fandom: null,
    rating: 'all_ages',
    products: ['zine', 'goods', 'food'],
    blurb: 'Zine masakan Minang, resep keluarga plus ilustrasi tangan.',
    works: 'Zine "Rendang Itu Sabar" edisi ketiga, plus sticker dan gantungan kunci.',
    shop: 'https://tokopedia.link/nasipadangpress',
  },
  {
    n: 12,
    code: 'C-04',
    name: '銀杏書房',
    furigana: 'いちょうしょぼう',
    pen: '森 かなえ',
    genre: '創作 / 小説',
    fandom: null,
    rating: 'all_ages',
    products: ['novel'],
    blurb: '創作小説サークル。地方都市を舞台にした連作短編を頒布します。',
    works: '第4集「銀杏の坂」文庫サイズ・192P。既刊も在庫あり。',
    shop: 'https://booth.pm/ichoshobo',
  },
  {
    n: 13,
    code: 'C-05',
    name: 'Studio Rimba',
    furigana: null,
    pen: 'Gita M.',
    genre: 'Original / Fantasy illustration',
    fandom: null,
    rating: 'r15',
    products: ['artbook', 'print', 'goods'],
    blurb: 'Artbook fantasi bertema hutan hujan Kalimantan, cat air digital.',
    works: 'Artbook 48 halaman full colour, print A3, dan set postcard.',
    twitter: 'studiorimba',
  },
  {
    n: 14,
    code: 'C-06',
    name: 'ぬるま湯',
    furigana: 'ぬるまゆ',
    pen: '日下部 あき',
    genre: '二次創作 / イラスト',
    fandom: 'ウマ娘',
    rating: 'r15',
    products: ['artbook', 'print'],
    blurb: 'ゆるい日常イラスト中心。カラー本とアクリルスタンドを頒布します。',
    works: 'イラスト本A4・28P、アクリルスタンド4種。',
    shop: 'https://booth.pm/nurumayu',
  },
  {
    n: 15,
    code: 'C-07',
    name: 'Antariksa Kecil',
    furigana: null,
    pen: 'Bayu Nugroho',
    genre: 'Original / Sci-fi',
    fandom: null,
    rating: 'all_ages',
    products: ['doujinshi', 'print'],
    blurb: 'Komik sci-fi pendek tentang stasiun luar angkasa di orbit Jawa.',
    works: 'Seri "Orbit Rendah" bab 1-4, A5 96 halaman, plus poster A2.',
  },
  {
    n: 16,
    code: 'C-08',
    name: '桃色電波',
    furigana: 'ももいろでんぱ',
    pen: '篠原 ユイ',
    genre: '二次創作 / 漫画',
    fandom: 'BanG Dream!',
    rating: 'r18',
    products: ['doujinshi', 'goods'],
    blurb: 'バンド系二次創作。成人向け新刊とグッズを頒布します。',
    works: '新刊B5・40P（成人向け）、缶バッジ6種。',
    twitter: 'momoirodenpa',
  },
]

export const catalogCircles: CircleRow[] = seeds.map((s) => ({
  id: uid('c', s.n),
  event_id: EVENT_ID,
  circle_code: s.code,
  circle_name: s.name,
  circle_name_furigana: s.furigana,
  // The trigger folds katakana to hiragana; the fixture only needs a stable key.
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
  product_types: s.products,
  description: s.blurb,
  works_description: s.works,
  social_media_twitter: s.twitter ?? null,
  social_media_pixiv: null,
  social_media_website: null,
  social_media_instagram: null,
  marketplace_link: s.shop ?? null,
  space_type: 'circle_space_1',
  additional_table: false,
  additional_chair: false,
  additional_power: false,
  exhibitor_passes: 2,
  previous_participation: s.n % 2 === 0,
  sells_commission: false,
  commission_rate: null,
  total_amount: 450_000,
  payment_status: 'paid',
  application_status: 'accepted',
  booth_number: s.code,
  special_requests: null,
  notes: null,
  submitted_at: iso(-28 + s.n),
  reviewed_at: iso(-14 + s.n),
  reviewed_by: null,
  review_notes: null,
  waitlist_position: null,
  created_at: iso(-35 + s.n),
  updated_at: iso(-6),
  user_id: null,
}))

/** A third aisle at y=16, so nothing overlaps the two `circles.ts` already draws. */
export const catalogBooths: BoothRow[] = catalogCircles.map((circle, i) => ({
  id: uid('b', 13 + i),
  event_id: EVENT_ID,
  booth_number: circle.circle_code!,
  booth_type: 'circle_space_1',
  size_width: 2,
  size_height: 1,
  position_x: 4 + (i + 1) * 3,
  position_y: 16,
  floor_level: 1,
  zone: circle.rating === 'r18' ? 'R18' : 'General',
  status: 'occupied',
  circle_id: circle.id,
  rotation: 0,
  label: circle.circle_name,
  created_at: iso(-20),
  updated_at: iso(-6),
}))

/** Day 2, so the schedule renders more than one day group. */
export const catalogSchedule: EventScheduleRow[] = [
  {
    id: uid('e', 21),
    event_id: EVENT_ID,
    title: {
      en: 'Cosplay contest — preliminaries',
      ja: 'コスプレコンテスト予選',
      id: 'Lomba cosplay — babak penyisihan',
    },
    description: {
      en: 'Registration closes 11:00 at the stage desk.',
      ja: '受付は11:00にステージ横で締め切ります。',
      id: 'Pendaftaran ditutup pukul 11.00 di meja panggung.',
    },
    starts_at: iso(0, 11),
    ends_at: iso(0, 12),
    location: 'Stage A',
    track: 'Stage',
    created_at: iso(-20),
    updated_at: iso(-20),
  },
  {
    id: uid('e', 22),
    event_id: EVENT_ID,
    title: { en: 'Doors open — day 2', ja: '2日目 一般入場', id: 'Pintu buka — hari 2' },
    description: { en: 'Gate 3 and Gate 5.', ja: 'ゲート3・5。', id: 'Gate 3 dan Gate 5.' },
    starts_at: iso(1, 9),
    ends_at: null,
    location: 'Gate 3 / Gate 5',
    track: 'Main',
    created_at: iso(-20),
    updated_at: iso(-20),
  },
  {
    id: uid('e', 23),
    event_id: EVENT_ID,
    title: {
      en: 'Talk: distributing doujin across borders',
      ja: 'トーク：同人誌の海外頒布',
      id: 'Bincang: distribusi doujin lintas negara',
    },
    description: {
      en: 'Circles from Jakarta and Tokyo compare shipping, customs and pricing.',
      ja: 'ジャカルタと東京のサークルが発送・通関・価格設定を比較します。',
      id: 'Circle dari Jakarta dan Tokyo membandingkan ongkir, bea cukai, dan harga.',
    },
    starts_at: iso(1, 14),
    ends_at: iso(1, 15),
    location: 'Stage B',
    track: 'Workshop',
    created_at: iso(-20),
    updated_at: iso(-20),
  },
  {
    id: uid('e', 24),
    event_id: EVENT_ID,
    title: { en: 'Hall closes — day 2', ja: '2日目 閉場', id: 'Hall tutup — hari 2' },
    description: { en: 'Last entry 16:00.', ja: '最終入場16:00。', id: 'Masuk terakhir 16.00.' },
    starts_at: iso(1, 17),
    ends_at: null,
    location: 'Hall 5-6',
    track: 'Main',
    created_at: iso(-20),
    updated_at: iso(-20),
  },
]
