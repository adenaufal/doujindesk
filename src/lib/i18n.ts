// -----------------------------------------------------------------------------
// FURIGANA IS NOT A TRANSLATION. It must never touch i18next.
//
// `circles.circle_name_furigana` / `circles.pen_name_furigana` hold a *reading
// aid* — 「東方地霊殿」→「とうほうちれいでん」 — not a Japanese display form.
// Serving furigana to JA users in place of the circle name produces gibberish:
// it is the same string spelled out in kana, which is how a child reads, not
// how a catalogue prints. Those columns exist for two jobs only:
//   1. kana sort order (五十音順) in the catalogue  — P13
//   2. kana search, so 「とうほう」 finds 「東方」   — P6 index + P13 query
// They are DATA, stored per circle, and belong in a table column. They are not
// translation keys and there is no en/id equivalent to write.
// -----------------------------------------------------------------------------

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LOCALES = ['en', 'ja', 'id'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** Endonyms — a language picker always names a language in that language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  id: 'Bahasa Indonesia',
}

/**
 * One namespace per route cluster. Feature packages add keys to the JSON files
 * that already exist; adding a *new* namespace means adding
 * `src/locales/<lng>/<ns>.json` for all three locales and a name here.
 */
export const NAMESPACES = [
  'common',
  'auth',
  'circle',
  'scanner',
  'catalog',
  'organizer',
  'shell',
  'floorplan',
] as const

export const STORAGE_KEY = 'doujindesk.locale'

type Bundle = Record<string, unknown>

// `en` is the fallback and the first paint — it ships in the main chunk.
const enBundles = import.meta.glob<Bundle>('../locales/en/*.json', {
  eager: true,
  import: 'default',
})

// ja/id load only when chosen, so a JA bundle never reaches an EN user.
// ponytail: one chunk per JSON file (12 tiny chunks), because Vite splits per
// dynamic import specifier. Six parallel HTTP/2 requests on a language switch
// is cheaper than the barrel file it would take to merge them. If the locale
// files grow past a few KB each, add `src/locales/<lng>/index.ts` re-exporting
// them and import that instead.
const lazyBundles = import.meta.glob<Bundle>(
  ['../locales/ja/*.json', '../locales/id/*.json'],
  { import: 'default' }
)

const nsFromPath = (path: string) => path.slice(path.lastIndexOf('/') + 1, -5)

const enResources: Record<string, Bundle> = {}
for (const [path, bundle] of Object.entries(enBundles)) {
  enResources[nsFromPath(path)] = bundle
}

const loaded = new Set<string>(['en'])

async function loadLocale(locale: Locale) {
  if (loaded.has(locale)) return
  const prefix = `../locales/${locale}/`
  await Promise.all(
    Object.entries(lazyBundles)
      .filter(([path]) => path.startsWith(prefix))
      .map(async ([path, load]) => {
        // `deep`/`overwrite` true: a later package can hot-add keys to a
        // namespace already in memory without clobbering the rest of it.
        i18n.addResourceBundle(locale, nsFromPath(path), await load(), true, true)
      })
  )
  loaded.add(locale)
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

function storedLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    // Safari private mode throws on localStorage access.
    return null
  }
}

/** localStorage override, else the browser's language, else English. */
export function detectLocale(): Locale {
  const stored = storedLocale()
  if (stored) return stored
  const nav = navigator.language?.split('-')[0]
  return isLocale(nav) ? nav : 'en'
}

// The `lang` attribute is not decoration: it picks the regional glyph variants
// for Han characters shared between JA and ZH, and it tells a screen reader
// which voice to read the page in. index.html hardcodes `en`.
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

const initial = detectLocale()

/**
 * Resolves once i18next is initialised and the active locale's bundles are in
 * memory. Await it in tests; app code does not need to — `fallbackLng: 'en'`
 * means the worst case during the ja/id fetch is English text, never a raw key.
 */
export const i18nReady = i18n
  .use(initReactI18next)
  .init({
    lng: initial,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES,
    ns: NAMESPACES,
    defaultNS: 'common',
    resources: { en: enResources },
    interpolation: {
      // React escapes for us; double-escaping mangles 「&」 in circle names.
      escapeValue: false,
    },
    react: {
      // Bundles arrive after init via addResourceBundle; without this, a
      // component mounted before the ja fetch lands stays in English forever.
      bindI18nStore: 'added',
    },
  })
  .then(() => loadLocale(initial))

/**
 * Change language. Loads the bundles first so nothing flashes English.
 * Prefer this over `i18n.changeLanguage` — that one skips the loader.
 */
export async function setLocale(locale: Locale) {
  await loadLocale(locale)
  await i18n.changeLanguage(locale)
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* private mode — the choice lasts for this tab only */
  }
  void persistToProfile(locale)
}

/**
 * Mirror the choice onto the signed-in profile so it follows a staffer from
 * their laptop to the phone they scan with. localStorage stays the source of
 * truth for the current session; this is a best-effort echo and every failure
 * is expected and swallowed (signed out, offline, migration 002 not applied).
 */
async function persistToProfile(locale: Locale) {
  try {
    // Imported lazily: `./supabase` throws at module scope when the env vars
    // are missing, and i18n must initialise in a bare jsdom test.
    const { supabase } = await import('./supabase')
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    await supabase.from('profiles').update({ locale }).eq('id', data.user.id)
  } catch {
    /* localStorage already holds it */
  }
}

export default i18n
