/**
 * The only place in the app where an amount becomes a string.
 *
 * Two axes, deliberately not coupled:
 *   - **currency is event-scoped.** It comes from `events.currency` / the ledger
 *     row, never from the viewer.
 *   - **locale is user-scoped.** It comes from i18next / `profiles.locale`.
 *
 * So a Japanese-speaking staffer looking at an Indonesian event sees IDR written
 * with Japanese grouping conventions. It must never turn into JPY. Passing the
 * user's locale as the currency is the single most likely bug in this file's
 * blast radius, which is why they are separate parameters with different types.
 */

export type Currency = 'IDR' | 'USD'

/**
 * IDR is conventionally written without minor units even though the column is
 * `numeric(x,2)` — nobody in Jakarta prices a ticket at Rp 150.000,00. USD keeps
 * its two decimals. This is a display rule only; the stored value is untouched.
 */
const FRACTION_DIGITS: Record<Currency, number> = { IDR: 0, USD: 2 }

// Constructing an Intl.NumberFormat is the expensive part, and a catalogue or a
// financial table formats hundreds of cells per render.
const formatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(amount: number, currency: Currency, locale: string): string {
  const key = `${locale}|${currency}`
  let nf = formatters.get(key)

  if (!nf) {
    const digits = FRACTION_DIGITS[currency]
    nf = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    formatters.set(key, nf)
  }

  return nf.format(amount)
}

export type AmountRow = {
  /** PostgREST serialises `numeric` as a JSON number, but a widened column read
   *  through a view or an RPC can arrive as a string. Accept both. */
  amount: number | string
  currency: Currency
  direction?: 'credit' | 'debit'
}

/**
 * Sum rows per currency, debits subtracting. Currencies are never added together
 * — there is no exchange rate in this product and inventing one silently is how
 * a financial report becomes fiction.
 *
 * ponytail: this is float64 arithmetic re-rounded to 2dp on every step, which is
 * exact well past any convention's takings but is still not decimal maths. It is
 * for the rare client-side case — a cart subtotal, a selection footer. **Any
 * figure shown to an organizer as a total must come from `event_financial_summary`,
 * which sums in Postgres `numeric`.** Upgrade path if that ever stops being true:
 * sum in integer minor units, or add a decimal library. Do not grow this function.
 */
export function sumByCurrency(rows: readonly AmountRow[]): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {}

  for (const row of rows) {
    const signed = (row.direction === 'debit' ? -1 : 1) * Number(row.amount)
    totals[row.currency] = Math.round(((totals[row.currency] ?? 0) + signed) * 100) / 100
  }

  return totals
}
