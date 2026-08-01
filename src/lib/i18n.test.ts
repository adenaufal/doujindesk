import { describe, expect, it } from 'vitest'

import i18n, { NAMESPACES, SUPPORTED_LOCALES, setLocale, type Locale } from './i18n'
import { i18nReady } from './i18n'

// The plural suffix is *supposed* to differ between locales: en has one/other,
// ja and id have other only (Intl.PluralRules). Compare the keys underneath it.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flatten(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  )
}

function keySet(locale: Locale, ns: string) {
  const bundle = i18n.getResourceBundle(locale, ns)
  return new Set(flatten(bundle).map((key) => key.replace(PLURAL_SUFFIX, '')))
}

describe('i18n', () => {
  it('initialises and loads every locale without error', async () => {
    await i18nReady
    await Promise.all(SUPPORTED_LOCALES.map((locale) => setLocale(locale)))
    expect(i18n.isInitialized).toBe(true)
  })

  it('sets document.documentElement.lang on language change', async () => {
    await setLocale('ja')
    expect(document.documentElement.lang).toBe('ja')
    await setLocale('id')
    expect(document.documentElement.lang).toBe('id')
    await setLocale('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('persists the choice to localStorage', async () => {
    await setLocale('ja')
    expect(localStorage.getItem('doujindesk.locale')).toBe('ja')
    await setLocale('en')
  })

  // The Done-when only demands this for `common`; every namespace costs nothing
  // extra and this is the check that fails when a Wave 5 package adds a key to
  // en and forgets ja/id — which renders the raw key on a Japanese screen.
  it.each(NAMESPACES)('has an identical key set across locales: %s', (ns) => {
    const en = keySet('en', ns)
    expect(en.size).toBeGreaterThan(0)
    for (const locale of SUPPORTED_LOCALES) {
      expect({ locale, ns, keys: [...keySet(locale, ns)].sort() }).toEqual({
        locale,
        ns,
        keys: [...en].sort(),
      })
    }
  })

  it('translates, falls back to en for an unknown key, and pluralises per locale', async () => {
    await setLocale('ja')
    expect(i18n.t('nav.dashboard')).toBe('ダッシュボード')
    // ja has no plural forms — one and many resolve to the same string.
    expect(i18n.t('scanner:sync.queued', { count: 1 })).toBe(
      i18n.t('scanner:sync.queued', { count: 12 }).replace('12', '1')
    )
    await setLocale('en')
    expect(i18n.t('scanner:conflict.body', { count: 1 })).toContain('ticket was')
    expect(i18n.t('scanner:conflict.body', { count: 3 })).toContain('tickets were')
  })
})
