/**
 * Database types — the single source of truth for every table, view, enum and
 * RPC this app touches.
 *
 * ponytail: HAND-DERIVED from `supabase/migrations/001…006.sql`, because those
 * migrations have never been applied and `supabase gen types` introspects a live
 * database. It cannot run until the owner pushes them. The moment they land,
 * replace this file wholesale with:
 *
 *     pnpm dlx supabase gen types typescript \
 *       --project-id iaieygnykpwckdwkhcqc --schema public \
 *       > src/lib/database.types.ts
 *
 * Ceiling: hand-derived types drift the day someone edits SQL without editing
 * here. The upgrade path above removes that risk permanently — run it first,
 * then diff.
 *
 * Shape note: the generated file writes `Row`/`Insert`/`Update` out in full per
 * table. Two helpers below (`Ins`, `Upd`) express the same thing in a third of
 * the lines, and `SupabaseClient<Database>` consumes them identically.
 */

/** Every column optional except `K` — the columns with no default and NOT NULL. */
type Ins<R, K extends keyof R = never> = Partial<R> & Pick<R, K>
/** PostgREST PATCH: any subset. */
type Upd<R> = Partial<R>

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ---------------------------------------------------------------------------
// Domain unions — every one of these is a CHECK constraint in SQL, verbatim.
// Widening one here does not widen it in Postgres; it only hides the 23514.
// ---------------------------------------------------------------------------

export type AppRole = 'organizer' | 'staff' | 'circle' | 'attendee'
export type Locale = 'en' | 'ja' | 'id'
export type CurrencyCode = 'IDR' | 'USD'
export type EventStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'ongoing'
  | 'completed'
  | 'cancelled'
/** 005 widened 001's domain with `draft` and `submitted`. */
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'waitlisted'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'cancelled'
export type SpaceType =
  | 'circle_space_1'
  | 'circle_space_2'
  | 'circle_space_4'
  | 'circle_booth_a'
  | 'circle_booth_b'
export type Rating = 'all_ages' | 'r15' | 'r18'
export type BoothStatus = 'available' | 'reserved' | 'occupied' | 'maintenance'
export type TicketStatus = 'active' | 'inactive' | 'sold_out'
/** `public.staff.role` is an event-scoped job title, not an account role. */
export type StaffRole = 'organizer' | 'coordinator' | 'scanner' | 'volunteer'
export type StaffStatus = 'active' | 'inactive' | 'on_break'
export type TransactionType =
  | 'circle_payment'
  | 'ticket_sale'
  | 'refund'
  | 'expense'
  | 'commission'
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded'
export type TransactionDirection = 'credit' | 'debit'
export type ScanTypeCode = 'entry' | 'exit' | 'reentry'
export type ScanResultCode =
  | 'admitted'
  | 'duplicate'
  | 'not_found'
  | 'unpaid'
  | 'revoked'
  | 'wrong_event'
  | 'outside_window'
export type TaskCategory =
  | 'setup'
  | 'operations'
  | 'security'
  | 'customer_service'
  | 'cleanup'
  | 'emergency'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type AnnouncementSeverity = 'info' | 'warning' | 'critical'
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type Audience = 'public' | 'circle' | 'staff' | 'attendee'
export type NotificationCategory =
  | 'announcement'
  | 'application'
  | 'payment'
  | 'booth'
  | 'ticket'
  | 'task'
  | 'system'
export type QueueType = 'entry' | 'circle' | 'merchandise' | 'food' | 'service'
export type QueueStatusCode = 'open' | 'paused' | 'closed'

/** `announcements.title`, `notifications.body`, `event_schedule.title` — jsonb keyed by locale. */
export type LocalisedText = Partial<Record<Locale, string>>

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface ProfileRow {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: AppRole
  locale: Locale
  notification_prefs: Json
  created_at: string
  updated_at: string
}

export interface EventRow {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  venue_name: string
  venue_address: string | null
  max_circles: number | null
  max_attendees: number | null
  registration_start: string | null
  registration_end: string | null
  status: EventStatus
  currency: CurrencyCode
  /** 002. IANA zone; the scan validity window is evaluated in it. */
  timezone: string
  /** 006. Canvas size, background image and grid for the floor-plan editor. */
  floor_plan: Json
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface CircleRow {
  id: string
  event_id: string
  /** 005 dropped NOT NULL: a draft has no code, and A-01 is the organizer's to allocate. */
  circle_code: string | null
  circle_name: string
  circle_name_furigana: string | null
  /** 005. Maintained by trigger (katakana folded to hiragana); never written by the client. */
  circle_name_sort_key: string | null
  pen_name: string
  pen_name_furigana: string | null
  email: string
  phone: string | null
  address: string | null
  postal_code: string | null
  country: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  co_rep_name: string | null
  co_rep_email: string | null
  co_rep_phone: string | null
  circle_cut_file_url: string | null
  sample_works_images: string[] | null
  fandom: string | null
  genre: string | null
  rating: Rating | null
  product_types: string[] | null
  description: string | null
  works_description: string | null
  social_media_twitter: string | null
  social_media_pixiv: string | null
  social_media_website: string | null
  social_media_instagram: string | null
  marketplace_link: string | null
  space_type: SpaceType | null
  additional_table: boolean
  additional_chair: boolean
  additional_power: boolean
  exhibitor_passes: number
  previous_participation: boolean
  /** 005 turned 001's DECIMAL into a boolean; the rate moved to `commission_rate`. */
  sells_commission: boolean
  commission_rate: number | null
  /** Recomputed server-side from `event_pricing` by trigger. Whatever the client sends is discarded. */
  total_amount: number
  payment_status: PaymentStatus
  application_status: ApplicationStatus
  /** @deprecated read the allocated number from `circle_catalog.booth_number`. */
  booth_number: string | null
  special_requests: string | null
  notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  waitlist_position: number | null
  created_at: string
  updated_at: string
  user_id: string | null
}

export interface BoothRow {
  id: string
  event_id: string
  booth_number: string
  booth_type: string
  size_width: number | null
  size_height: number | null
  position_x: number | null
  position_y: number | null
  floor_level: number
  zone: string | null
  status: BoothStatus
  /** The single source of truth for allocation. `booths_no_overlap` arbitrates geometry. */
  circle_id: string | null
  rotation: number
  label: string | null
  created_at: string
  updated_at: string
}

export interface TicketRow {
  id: string
  event_id: string
  ticket_type: string
  price: number
  currency: CurrencyCode
  early_bird_price: number | null
  early_bird_end: string | null
  quantity_available: number
  quantity_sold: number
  sale_start: string | null
  sale_end: string | null
  valid_from: string | null
  valid_until: string | null
  age_restriction: string | null
  requires_id: boolean
  description: string | null
  benefits: string[] | null
  status: TicketStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TicketPurchaseRow {
  id: string
  event_id: string
  ticket_id: string
  user_id: string | null
  quantity: number
  unit_price: number | null
  total_amount: number
  currency: CurrencyCode | null
  order_reference: string | null
  /** Canonical order state. There is no separate `status` column — see PROGRESS, P5. */
  payment_status: PaymentStatus
  qr_code: string | null
  rfid_code: string | null
  attendee_name: string | null
  attendee_email: string | null
  attendee_phone: string | null
  check_in_time: string | null
  cancelled_at: string | null
  refunded_at: string | null
  created_at: string
  updated_at: string
}

export interface TicketPassRow {
  id: string
  purchase_id: string
  event_id: string
  /** Opaque uuid. The whole scannable payload — see `src/lib/ticketCode.ts`. */
  qr_token: string
  holder_name: string | null
  tier_id: string | null
  valid_from: string | null
  valid_until: string | null
  revoked_at: string | null
  created_at: string
}

export interface TicketScanRow {
  id: string
  event_id: string
  pass_id: string | null
  scanned_code: string
  scan_type: ScanTypeCode
  result: ScanResultCode
  gate_id: string | null
  device_id: string
  scanned_by: string | null
  scanned_at: string
  synced_at: string
  offline: boolean
  client_scan_id: string
  conflict_with: string | null
}

export interface StaffRow {
  id: string
  event_id: string
  user_id: string
  name: string
  email: string
  phone: string | null
  role: StaffRole
  permissions: string[] | null
  shift_start: string | null
  shift_end: string | null
  assigned_zones: string[] | null
  status: StaffStatus
  invited_by: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface FinancialTransactionRow {
  id: string
  event_id: string
  transaction_type: TransactionType
  direction: TransactionDirection
  reference_id: string | null
  reference_table: string | null
  amount: number
  currency: CurrencyCode
  payment_method: string | null
  payment_gateway: string | null
  gateway_transaction_id: string | null
  idempotency_key: string | null
  status: TransactionStatus
  description: string | null
  metadata: Json
  occurred_at: string
  reverses_transaction_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EventPricingRow {
  id: string
  event_id: string
  space_type: SpaceType
  price: number
  addon_table_price: number
  addon_chair_price: number
  addon_power_price: number
  extra_pass_price: number
  currency: CurrencyCode
  created_at: string
  updated_at: string
}

export interface StaffTaskRow {
  id: string
  event_id: string
  title: string
  description: string | null
  category: TaskCategory
  priority: TaskPriority
  status: TaskStatus
  due_at: string | null
  location: string | null
  /** uuid[] with a GIN index, not a join table. */
  assigned_to: string[]
  created_by: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

export interface AnnouncementRow {
  id: string
  event_id: string
  title: LocalisedText
  body: LocalisedText
  severity: AnnouncementSeverity
  audience: Audience[]
  status: AnnouncementStatus
  publish_at: string | null
  expires_at: string | null
  pinned: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  event_id: string
  category: NotificationCategory
  title: LocalisedText
  body: LocalisedText
  data: Json
  announcement_id: string | null
  read_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface EventScheduleRow {
  id: string
  event_id: string
  title: LocalisedText
  description: LocalisedText
  starts_at: string
  ends_at: string | null
  location: string | null
  track: string | null
  created_at: string
  updated_at: string
}

export interface QueueRow {
  id: string
  event_id: string
  name: string
  location: string | null
  type: QueueType
  capacity: number | null
  status: QueueStatusCode
  current_length: number
  current_wait_minutes: number
  created_at: string
  updated_at: string
}

/**
 * One row per event. Written only by trigger. Subscribing to this instead of the
 * raw scan stream is what keeps doors-open realtime traffic O(clients).
 */
export interface EventCounterRow {
  event_id: string
  admitted_count: number
  queue_total: number
  updated_at: string
}

// ---------------------------------------------------------------------------
// Views — read-only, no Insert/Update
// ---------------------------------------------------------------------------

/**
 * The public catalog. THE COLUMN LIST IS THE ACCESS CONTROL — the view reads past
 * `circles` RLS, so anything added here becomes world-readable. Never add email,
 * phone, address, co_rep_*, emergency_*, notes, review_notes, total_amount or
 * payment_status. See the `COMMENT ON VIEW` in 006.
 */
export interface CircleCatalogRow {
  id: string
  event_id: string
  circle_code: string | null
  circle_name: string
  circle_name_furigana: string | null
  circle_name_sort_key: string | null
  pen_name: string
  fandom: string | null
  genre: string | null
  rating: Rating | null
  product_types: string[] | null
  description: string | null
  works_description: string | null
  circle_cut_file_url: string | null
  sample_works_images: string[] | null
  social_media_twitter: string | null
  social_media_pixiv: string | null
  social_media_website: string | null
  social_media_instagram: string | null
  marketplace_link: string | null
  booth_number: string | null
}

/** Grouped by (event, currency, type, direction). `net_amount` is already signed. */
export interface EventFinancialSummaryRow {
  event_id: string
  currency: CurrencyCode
  transaction_type: TransactionType
  direction: TransactionDirection
  transaction_count: number
  total_amount: number
  net_amount: number
  pending_amount: number
  last_transaction_at: string | null
}

// ---------------------------------------------------------------------------
// The Database shape supabase-js consumes
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Ins<ProfileRow, 'id' | 'email'>
        Update: Upd<ProfileRow>
        Relationships: []
      }
      events: {
        Row: EventRow
        Insert: Ins<EventRow, 'name' | 'start_date' | 'end_date' | 'venue_name'>
        Update: Upd<EventRow>
        Relationships: []
      }
      circles: {
        Row: CircleRow
        Insert: Ins<CircleRow, 'event_id' | 'circle_name' | 'pen_name' | 'email'>
        Update: Upd<CircleRow>
        Relationships: []
      }
      booths: {
        Row: BoothRow
        Insert: Ins<BoothRow, 'event_id' | 'booth_number' | 'booth_type'>
        Update: Upd<BoothRow>
        Relationships: []
      }
      tickets: {
        Row: TicketRow
        Insert: Ins<TicketRow, 'event_id' | 'ticket_type' | 'price'>
        Update: Upd<TicketRow>
        Relationships: []
      }
      ticket_purchases: {
        Row: TicketPurchaseRow
        Insert: Ins<TicketPurchaseRow, 'event_id' | 'ticket_id' | 'total_amount'>
        Update: Upd<TicketPurchaseRow>
        Relationships: []
      }
      ticket_passes: {
        Row: TicketPassRow
        Insert: Ins<TicketPassRow, 'purchase_id' | 'event_id'>
        Update: Upd<TicketPassRow>
        Relationships: []
      }
      ticket_scans: {
        Row: TicketScanRow
        Insert: Ins<
          TicketScanRow,
          'event_id' | 'scanned_code' | 'result' | 'device_id' | 'scanned_at' | 'client_scan_id'
        >
        Update: Upd<TicketScanRow>
        Relationships: []
      }
      staff: {
        Row: StaffRow
        Insert: Ins<StaffRow, 'event_id' | 'user_id' | 'name' | 'email' | 'role'>
        Update: Upd<StaffRow>
        Relationships: []
      }
      financial_transactions: {
        Row: FinancialTransactionRow
        Insert: Ins<
          FinancialTransactionRow,
          'event_id' | 'transaction_type' | 'amount' | 'currency'
        >
        Update: Upd<FinancialTransactionRow>
        Relationships: []
      }
      event_pricing: {
        Row: EventPricingRow
        Insert: Ins<EventPricingRow, 'event_id' | 'space_type'>
        Update: Upd<EventPricingRow>
        Relationships: []
      }
      staff_tasks: {
        Row: StaffTaskRow
        Insert: Ins<StaffTaskRow, 'event_id' | 'title'>
        Update: Upd<StaffTaskRow>
        Relationships: []
      }
      announcements: {
        Row: AnnouncementRow
        Insert: Ins<AnnouncementRow, 'event_id'>
        Update: Upd<AnnouncementRow>
        Relationships: []
      }
      notifications: {
        Row: NotificationRow
        Insert: Ins<NotificationRow, 'user_id' | 'event_id'>
        Update: Upd<NotificationRow>
        Relationships: []
      }
      event_schedule: {
        Row: EventScheduleRow
        Insert: Ins<EventScheduleRow, 'event_id' | 'starts_at'>
        Update: Upd<EventScheduleRow>
        Relationships: []
      }
      queues: {
        Row: QueueRow
        Insert: Ins<QueueRow, 'event_id' | 'name'>
        Update: Upd<QueueRow>
        Relationships: []
      }
      event_counters: {
        Row: EventCounterRow
        Insert: Ins<EventCounterRow, 'event_id'>
        Update: Upd<EventCounterRow>
        Relationships: []
      }
    }
    Views: {
      circle_catalog: { Row: CircleCatalogRow; Relationships: [] }
      event_financial_summary: { Row: EventFinancialSummaryRow; Relationships: [] }
    }
    Functions: {
      /** 003. The only door into `ticket_scans`. Idempotent on `client_scan_id`. */
      redeem_tickets: {
        Args: { p_scans: Json }
        Returns: Json
      }
      /** 004. The only write path into `ticket_purchases`. Prices server-side. */
      purchase_tickets: {
        Args: { p_ticket_id: string; p_quantity: number; p_holder_names?: string[] | null }
        Returns: Json
      }
    }
    Enums: {
      app_role: AppRole
    }
    CompositeTypes: Record<string, never>
  }
}

/** `TableRow<'circles'>` beats repeating `Database['public']['Tables'][…]['Row']`. */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
