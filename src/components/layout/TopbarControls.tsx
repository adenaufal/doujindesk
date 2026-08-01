import { useEffect, useState } from 'react'
import { LogOut, Moon, Sun, Wifi, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'

/** The three small controls both chrome layouts share. */

export function ThemeToggle() {
  const { t } = useTranslation()
  const { isDark, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={`${t('shell.theme')}: ${isDark ? t('shell.themeDark') : t('shell.themeLight')}`}
      title={t('shell.theme')}
    >
      {isDark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </Button>
  )
}

/**
 * Connectivity, rendered once in the shell instead of once inside Dashboard —
 * the screen that actually needs it is the scanner on venue wifi, and that one
 * had none.
 *
 * ponytail: connectivity only, no last-sync timestamp. A real "last synced"
 * figure belongs to the scan queue (P10) and the query cache (P9); neither
 * exists yet, and a made-up timestamp on a screen an operator trusts is worse
 * than no timestamp. Upgrade path: read the queue's newest `synced_at` here.
 */
export function ConnectivityChip({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return (
    <Badge
      variant={online ? 'success' : 'warning'}
      // aria-live: going offline mid-shift has to announce itself, not wait to
      // be noticed.
      role="status"
      aria-live="polite"
      className={className}
    >
      {online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
      <span>{online ? t('status.online') : t('status.offline')}</span>
    </Badge>
  )
}

/**
 * Identity in the topbar, scope in the sidebar — never merged. A Dialog rather
 * than a popover menu: it is two lines of identity and one destructive action,
 * `@radix-ui/react-dropdown-menu` is not installed, and a Dialog is the
 * accessible primitive that already ships here.
 */
export function AccountMenu() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return (
      <Button asChild size="sm">
        <Link to={`/login?next=${next}`}>{t('action.signIn')}</Link>
      </Button>
    )
  }

  async function handleSignOut() {
    await signOut()
    setOpen(false)
    navigate('/', { replace: true })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('shell.account')}>
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="size-7" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="truncate">{user.name}</DialogTitle>
          <DialogDescription className="truncate">{user.email}</DialogDescription>
        </DialogHeader>
        {role && <RoleBadge role={role} />}
        <Button variant="outline" className="w-full" onClick={() => void handleSignOut()}>
          <LogOut aria-hidden="true" />
          {t('action.signOut')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation()
  return <Badge variant="outline">{t(`role.${role}`, { defaultValue: role })}</Badge>
}

export function UserAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string
  avatarUrl: string | null
  className?: string
}) {
  return (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className="text-xs font-medium uppercase">{name.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}
