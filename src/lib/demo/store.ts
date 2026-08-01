/**
 * The in-memory demo database.
 *
 * Reads resolve from here, writes mutate it, and nothing is persisted — a reload
 * puts the fixtures back. That is deliberate: the point of demo mode is a
 * predictable clickable app before the migrations are applied, not a second
 * database to keep in sync.
 *
 * The two views are computed on read, exactly as the SQL views derive them, so a
 * demo write shows up in the catalog and the financial summary without any
 * bookkeeping here.
 */
import type { CircleCatalogRow, EventFinancialSummaryRow } from '../database.types'
import { seedTables, type Row, type SeedTables } from '../fixtures'

export const tables: SeedTables = seedTables()

// ---------------------------------------------------------------------------
// Change notification — what makes the fake realtime channel real enough
// ---------------------------------------------------------------------------

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE'
type Listener = (table: string, event: ChangeEvent, row: Row) => void

const listeners = new Set<Listener>()

export function onChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emit(table: string, event: ChangeEvent, row: Row): void {
  for (const fn of listeners) fn(table, event, row)
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const CATALOG_COLUMNS: (keyof CircleCatalogRow)[] = [
  'id',
  'event_id',
  'circle_code',
  'circle_name',
  'circle_name_furigana',
  'circle_name_sort_key',
  'pen_name',
  'fandom',
  'genre',
  'rating',
  'product_types',
  'description',
  'works_description',
  'circle_cut_file_url',
  'sample_works_images',
  'social_media_twitter',
  'social_media_pixiv',
  'social_media_website',
  'social_media_instagram',
  'marketplace_link',
]

/**
 * THE COLUMN LIST IS THE ACCESS CONTROL — the same rule as the SQL view. This
 * projection is explicit for that reason; do not replace it with a spread.
 */
function circleCatalog(): Row[] {
  const draftEvents = new Set(
    tables.events.filter((e) => e.status === 'draft').map((e) => e.id as string),
  )
  return tables.circles
    .filter((c) => c.application_status === 'accepted' && !draftEvents.has(c.event_id as string))
    .map((c) => {
      const out: Row = {}
      for (const key of CATALOG_COLUMNS) out[key] = c[key] ?? null
      const booth = tables.booths.find((b) => b.circle_id === c.id)
      out.booth_number = booth?.booth_number ?? null
      return out
    })
}

/** GROUP BY (event_id, currency, transaction_type, direction), signed by direction. */
function financialSummary(): Row[] {
  const groups = new Map<string, EventFinancialSummaryRow>()
  for (const t of tables.financial_transactions) {
    const key = [t.event_id, t.currency, t.transaction_type, t.direction].join('|')
    const g =
      groups.get(key) ??
      ({
        event_id: t.event_id as string,
        currency: t.currency as EventFinancialSummaryRow['currency'],
        transaction_type: t.transaction_type as EventFinancialSummaryRow['transaction_type'],
        direction: t.direction as EventFinancialSummaryRow['direction'],
        transaction_count: 0,
        total_amount: 0,
        net_amount: 0,
        pending_amount: 0,
        last_transaction_at: null,
      } satisfies EventFinancialSummaryRow)

    const amount = Number(t.amount) || 0
    if (t.status === 'completed') {
      g.transaction_count += 1
      g.total_amount += amount
      g.net_amount += t.direction === 'credit' ? amount : -amount
      const at = String(t.occurred_at ?? t.created_at ?? '')
      if (!g.last_transaction_at || at > g.last_transaction_at) g.last_transaction_at = at
    } else if (t.status === 'pending') {
      g.pending_amount += amount
    }
    groups.set(key, g)
  }
  return [...groups.values()] as unknown as Row[]
}

const VIEWS: Record<string, () => Row[]> = {
  circle_catalog: circleCatalog,
  event_financial_summary: financialSummary,
}

export const isView = (name: string): boolean => name in VIEWS

/** Rows for any table or view. Views are recomputed per call — the sets are small. */
export function rowsOf(name: string): Row[] {
  const view = VIEWS[name]
  if (view) return view()
  if (!tables[name]) tables[name] = []
  return tables[name]
}
