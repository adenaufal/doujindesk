import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import App from '@/App'
import { queryClient } from '@/lib/queryClient'

import { USER } from '../fixtures'
import { demoSignInAs } from './client'

/**
 * The check that matters for demo mode: with fixtures behind the client, an
 * organizer can land on a real route and the app renders instead of throwing.
 *
 * Deliberately one route, not fourteen. This asserts the seam is wired — that
 * `main.tsx`'s provider, the demo auth session and a query hook agree — and
 * leaves per-screen coverage to the packages that own the screens.
 */
beforeAll(() => {
  // jsdom ships neither, and the shell reads both on mount.
  window.matchMedia ??= ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
})

describe('demo mode smoke', () => {
  it('renders an organizer route with fixture data and no crash', async () => {
    demoSignInAs(USER.organizer)
    window.history.pushState({}, '', '/e/eeeeeeee-0000-4000-8000-000000000001/dashboard')

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    )

    // The role guard resolves the demo session, then the shell paints.
    await waitFor(() => expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0), {
      timeout: 4000,
    })
  })
})
