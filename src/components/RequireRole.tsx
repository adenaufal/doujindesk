import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { homeForRole } from '@/components/layout/nav'
import { useAuthStore, type AppRole } from '@/stores/authStore'

/**
 * The route guard. One component — not a factory, not a HOC — wrapped around a
 * layout element so the guard and the chrome nest together:
 *
 *   <Route element={<RequireRole roles={['organizer']}><AppLayout /></RequireRole>}>
 *
 * While the session is still resolving it renders a skeleton and redirects
 * nowhere: bouncing to /login on every refresh, before `getSession()` has come
 * back, is the classic way a signed-in organizer gets logged out by a reload.
 */
export function RequireRole({ roles, children }: { roles: readonly AppRole[]; children: ReactNode }) {
  const loading = useAuthStore((s) => s.loading)
  const session = useAuthStore((s) => s.session)
  const role = useAuthStore((s) => s.role)
  const location = useLocation()

  if (loading) return <RouteSkeleton />

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (!role || !roles.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />
  }

  return <>{children}</>
}

function RouteSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-dvh flex-col gap-4 p-6"
    >
      <span className="sr-only">Loading</span>
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}

export default RequireRole
