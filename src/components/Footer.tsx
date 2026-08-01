import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { PUBLIC_NAV, visibleItems } from '@/components/layout/nav'

/**
 * Public footer only. The old one listed Financial, Staff, Booths and Manage to
 * anonymous attendees — every link now comes from the role-aware table in
 * `layout/nav.ts`, and this layout is the public one, so it shows public links.
 * The "Features" column that advertised offline-first and PWA capabilities is
 * gone: it described the README, not the code.
 */
export function Footer() {
  const { t } = useTranslation()
  const { eventId } = useParams()
  const links = visibleItems(PUBLIC_NAV, null, eventId)

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-foreground">{t('app.name')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('app.tagline')}</p>
        </div>

        {links.length > 0 && (
          <nav aria-label={t('shell.menu')}>
            <ul className="grid gap-1 sm:grid-cols-2">
              {links.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.to}
                    className="inline-flex items-center rounded-md py-1.5 pr-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11"
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <LanguageSwitcher className="md:hidden" />
      </div>

      <div className="border-t border-border">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {t('app.name')}
        </p>
      </div>
    </footer>
  )
}

export default Footer
