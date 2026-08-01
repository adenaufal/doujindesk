import { useTranslation } from 'react-i18next'

/**
 * Locale-aware formatting shared by the organizer and staff screens.
 *
 * Separate from `components/ops.tsx` because a module that exports both
 * components and plain functions breaks Vite's fast refresh — the react-refresh
 * rule is right about that, and these were never components.
 */

/** Locale-aware "3 minutes ago" without a date library. */
export function useRelativeTime() {
  const { i18n } = useTranslation()
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })

  return (iso: string | null | undefined): string => {
    if (!iso) return ''
    const diff = Date.parse(iso) - Date.now()
    const minutes = Math.round(diff / 60_000)
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
    const hours = Math.round(minutes / 60)
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
    return rtf.format(Math.round(hours / 24), 'day')
  }
}

export function useDateTime() {
  const { i18n } = useTranslation()
  return (iso: string | null | undefined, withTime = true): string =>
    iso
      ? new Date(iso).toLocaleString(i18n.language, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        })
      : '—'
}

/** Initials for `ui/avatar` fallbacks — two glyphs, CJK-safe. */
export function initials(name: string | null | undefined): string {
  const text = (name ?? '').trim()
  if (!text) return '?'
  const words = text.split(/\s+/)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  return [...text].slice(0, 2).join('').toUpperCase()
}
