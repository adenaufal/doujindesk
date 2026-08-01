import { describe, expect, it } from 'vitest'
import { formatMoney, sumByCurrency } from './money'

const LOCALES = ['en', 'ja', 'id'] as const

/** Intl separates the symbol with U+00A0 in several locales; compare on digits. */
const digitsOf = (s: string) => s.replace(/\D/g, '')

/** Matches a two-digit minor unit at the end: "…,50" / "….50". */
const hasMinorUnits = (s: string) => /[.,]\d{2}$/.test(s)

describe('formatMoney', () => {
  it('renders IDR without minor units in every supported locale', () => {
    for (const locale of LOCALES) {
      const out = formatMoney(1234567.89, 'IDR', locale)
      expect(hasMinorUnits(out), `${locale}: ${out}`).toBe(false)
      expect(digitsOf(out), `${locale}: ${out}`).toBe('1234568')
    }
  })

  it('renders USD with two decimals in every supported locale', () => {
    for (const locale of LOCALES) {
      const out = formatMoney(1234.5, 'USD', locale)
      expect(hasMinorUnits(out), `${locale}: ${out}`).toBe(true)
      expect(digitsOf(out), `${locale}: ${out}`).toBe('123450')
    }
    expect(formatMoney(1234.5, 'USD', 'en')).toBe('$1,234.50')
  })

  // The regression this whole module exists to prevent: locale is the viewer,
  // currency is the event. A ja-locale user browsing an Indonesian event must
  // never be shown yen.
  it('never renders IDR as yen for a ja-locale viewer', () => {
    const out = formatMoney(150000, 'IDR', 'ja')
    expect(out).not.toContain('¥')
    expect(out).not.toContain('JPY')
    expect(out).toMatch(/IDR|Rp/)
  })

  it('rounds IDR rather than truncating', () => {
    expect(digitsOf(formatMoney(1500.6, 'IDR', 'en'))).toBe('1501')
  })
})

describe('sumByCurrency', () => {
  it('keeps currencies apart and subtracts debits', () => {
    const totals = sumByCurrency([
      { amount: 150000, currency: 'IDR' },
      { amount: '250000', currency: 'IDR' },
      { amount: 50000, currency: 'IDR', direction: 'debit' },
      { amount: 25, currency: 'USD', direction: 'credit' },
    ])

    expect(totals.IDR).toBe(350000)
    expect(totals.USD).toBe(25)
  })

  it('does not accumulate float drift across many rows', () => {
    const rows = Array.from({ length: 300 }, () => ({ amount: 0.1, currency: 'USD' as const }))
    expect(sumByCurrency(rows).USD).toBe(30)
  })

  it('returns an empty object for no rows', () => {
    expect(sumByCurrency([])).toEqual({})
  })
})
