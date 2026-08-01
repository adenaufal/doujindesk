import type { Session } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import RequireRole from './RequireRole'
import { useAuthStore } from '@/stores/authStore'

// No mocking library and no fake timers: the guard is a pure function of
// (loading, session, role) and MemoryRouter tells us where it sent us.
// `useAuthStore.setState` is the whole test harness.
const SESSION = { user: { id: 'u1' }, access_token: 't' } as unknown as Session

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/wallet" element={<p>wallet page</p>} />
        <Route
          path="/e/:eventId/financial"
          element={
            <RequireRole roles={['organizer']}>
              <p>financial screen</p>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireRole', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, user: null, role: null, loading: false, error: null })
  })

  it('sends an unauthenticated visitor to /login, remembering where they were going', () => {
    renderAt('/e/evt-1/financial')

    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('financial screen')).not.toBeInTheDocument()
  })

  it('redirects an attendee away from an organizer screen instead of rendering it', () => {
    useAuthStore.setState({ session: SESSION, role: 'attendee' })

    renderAt('/e/evt-1/financial')

    expect(screen.queryByText('financial screen')).not.toBeInTheDocument()
    expect(screen.getByText('wallet page')).toBeInTheDocument()
  })

  it('renders the screen for the role it belongs to', () => {
    useAuthStore.setState({ session: SESSION, role: 'organizer' })

    renderAt('/e/evt-1/financial')

    expect(screen.getByText('financial screen')).toBeInTheDocument()
  })

  it('while the session is still loading, neither renders nor redirects', () => {
    // A refresh must not bounce a signed-in organizer to the login page just
    // because getSession() has not come back yet.
    useAuthStore.setState({ session: null, role: null, loading: true })

    renderAt('/e/evt-1/financial')

    expect(screen.queryByText('financial screen')).not.toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })
})
