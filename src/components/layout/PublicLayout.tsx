import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'

import Footer from '@/components/Footer'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { AccountMenu, ThemeToggle } from '@/components/layout/TopbarControls'
import { ACCOUNT_NAV, PUBLIC_NAV, visibleItems } from '@/components/layout/nav'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

/**
 * Topbar + footer, no rail. Attendees and circles get two or three screens on a
 * phone; an admin sidebar would be chrome nobody in this layout can use.
 */
export function PublicLayout() {
  const { t } = useTranslation()
  const { eventId } = useParams()
  const role = useAuthStore((s) => s.role)

  const links = [
    ...visibleItems(PUBLIC_NAV, null, eventId),
    ...visibleItems(ACCOUNT_NAV, role, eventId),
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t('shell.skipToContent')}
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-md py-1 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground"
            >
              DD
            </span>
            {t('app.name')}
          </Link>

          <div className="flex-1" />

          <LanguageSwitcher className="hidden md:flex" />
          <ThemeToggle />
          <AccountMenu />
        </div>

        {links.length > 0 && (
          <nav
            aria-label={t('shell.menu')}
            className="mx-auto w-full max-w-6xl px-4 pb-2"
          >
            {/* Wraps rather than scrolls: a second row at 320px beats a hidden
                horizontal scroll region on the primary navigation. */}
            <ul className="flex flex-wrap gap-1">
              {links.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors coarse:min-h-11',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive && 'bg-accent font-medium text-accent-foreground'
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="main" className="min-w-0 flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}

export default PublicLayout
