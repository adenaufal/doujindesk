import { useSyncExternalStore } from 'react'

// -----------------------------------------------------------------------------
// Theme, as one module-level store rather than per-component `useState`.
//
// The old hook kept the theme in local state, so every caller had its own copy
// and `toggleTheme` was never wired to anything — the ~60 authored `dark:`
// variants in this app only lit up as a side effect of <Toaster /> rendering.
//
// `null` preference means "follow the OS", which is the default and keeps
// following the OS when it changes at sunset. Touching the toggle writes an
// explicit choice to localStorage and stops following.
//
// ponytail: no Provider and no Zustand — useSyncExternalStore over a module
// singleton is the whole feature. Upgrade path if a per-event brand theme ever
// lands: make this a context so a subtree can override it.
// -----------------------------------------------------------------------------

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

// jsdom does not implement matchMedia; guarded so importing this module in a
// test does not throw.
const media =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

function readPreference(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    // Safari private mode throws on localStorage access.
    return null
  }
}

let preference: Theme | null = readPreference()
const listeners = new Set<() => void>()

function resolveTheme(): Theme {
  return preference ?? (media?.matches ? 'dark' : 'light')
}

function paint() {
  if (typeof document === 'undefined') return
  const theme = resolveTheme()
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.style.colorScheme = theme
}

function emit() {
  paint()
  for (const listener of listeners) listener()
}

media?.addEventListener('change', () => {
  if (preference === null) emit()
})

paint()

/** Pass `null` to go back to following the OS. */
export function setTheme(next: Theme | null) {
  preference = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, next)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode — the choice lasts for this tab only */
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, resolveTheme, () => 'light' as Theme)
  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }
}
