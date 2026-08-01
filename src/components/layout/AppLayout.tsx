import { useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { EventSwitcher } from '@/components/layout/EventSwitcher'
import {
  AccountMenu,
  ConnectivityChip,
  RoleBadge,
  ThemeToggle,
  UserAvatar,
} from '@/components/layout/TopbarControls'
import { appNavFor, findAppNavItem } from '@/components/layout/nav'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

/**
 * The organizer / staff shell: 240px sidebar on `lg`, a drawer below it.
 *
 * Every feature screen still renders its own `min-h-screen` wrapper today; those
 * belong to the Wave 5 packages and are stripped there, not here. Until then the
 * shell simply contains them.
 */
export function AppLayout() {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const crumb = findAppNavItem(location.pathname)

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t('shell.skipToContent')}
      </a>

      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarContent />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('shell.openMenu')}>
                <Menu aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent className="left-0 top-0 h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-l-0 border-sidebar-border bg-sidebar p-0 sm:rounded-none">
              <DialogTitle className="sr-only">{t('shell.menu')}</DialogTitle>
              <DialogDescription className="sr-only">{t('app.tagline')}</DialogDescription>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </DialogContent>
          </Dialog>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            {crumb ? (
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="hidden shrink-0 text-muted-foreground sm:block">
                  {t(`nav.group.${crumb.group}`)}
                </li>
                <li aria-hidden="true" className="hidden shrink-0 text-muted-foreground sm:block">
                  ›
                </li>
                <li className="truncate font-medium text-foreground" aria-current="page">
                  {t(crumb.item.labelKey)}
                </li>
              </ol>
            ) : null}
          </nav>

          <ConnectivityChip />
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild aria-label={t('shell:nav.notifications')}>
            <Link to="/notifications">
              <Bell aria-hidden="true" />
            </Link>
          </Button>
          <AccountMenu />
        </header>

        <main id="main" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { eventId } = useParams()
  const role = useAuthStore((s) => s.role)
  const user = useAuthStore((s) => s.user)
  const groups = appNavFor(role, eventId)

  return (
    <div className="flex h-full flex-col text-sidebar-foreground">
      <div className="flex flex-col gap-3 p-3">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground"
          >
            DD
          </span>
          {t('app.name')}
        </Link>
        <EventSwitcher />
      </div>

      <nav aria-label={t('shell.menu')} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {groups.map((group) => (
          <div key={group.key} className="mb-4">
            <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/80">
              {t(`nav.group.${group.key}`)}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors coarse:min-h-11',
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                        isActive &&
                          'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="px-2 text-xs text-sidebar-foreground">{t('event.none')}</p>
        )}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        <LanguageSwitcher className="w-full border-sidebar-border" />
        {user && (
          <div className="flex items-center gap-2">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{user.name}</p>
              {role && <RoleBadge role={role} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AppLayout
