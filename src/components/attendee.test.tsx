import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18nReady } from '@/lib/i18n'

import CircleCatalog from './CircleCatalog'
import TicketWallet from './TicketWallet'
import TicketingSystem from './TicketingSystem'
import { EVENT_ID, USER } from '@/lib/fixtures'
import { ticket_passes } from '@/lib/fixtures/tickets'
import { demoSignInAs } from '@/lib/demo/client'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * The three claims of this package that are worth a runnable check, against the
 * demo fixtures (no database, no network):
 *
 *  1. the catalog gates R18 at the CARD, not at the detail page;
 *  2. the wallet's QR payload is the pass's own `qr_token` and nothing else;
 *  3. checkout goes through the `purchase_tickets` RPC — no client-sent price,
 *     no client-written `payment_status`.
 */

// jsdom has no canvas, and the real generator would reject.
vi.mock('@/lib/qrcode', () => ({
  QRCodeGenerator: {
    generateQRCode: vi.fn(async (token: string) => `data:image/png;base64,${token}`),
  },
}))
const { QRCodeGenerator } = await import('@/lib/qrcode')

function wrap(ui: React.ReactNode, path: string, url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function signInAsAttendee() {
  demoSignInAs(USER.attendee)
  useAuthStore.setState({
    user: {
      id: USER.attendee,
      email: 'attendee@example.com',
      name: 'Dimas Aditya',
      avatarUrl: null,
      role: 'attendee',
    },
    role: 'attendee',
    loading: false,
  })
}

beforeAll(async () => {
  // Without this every label renders as its raw key.
  await i18nReady
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('circle catalog', () => {
  it('lists circles from the catalog view and hides R18 behind a reveal', async () => {
    render(wrap(<CircleCatalog />, '/e/:eventId/catalog', `/e/${EVENT_ID}/catalog`))

    await waitFor(() => expect(screen.getByText('Kopi Susu Studio')).toBeInTheDocument())

    // An accepted R18 circle is in the data, but its name is not on screen.
    expect(screen.queryByText('深夜零時')).toBeNull()
    for (const reveal of screen.getAllByRole('button', { name: /R18/i })) {
      await userEvent.click(reveal)
    }
    await waitFor(() => expect(screen.getByText('深夜零時')).toBeInTheDocument())
  })

  it('filters by search across name, pen name and booth code', async () => {
    render(wrap(<CircleCatalog />, '/e/:eventId/catalog', `/e/${EVENT_ID}/catalog`))
    await waitFor(() => expect(screen.getByText('Kopi Susu Studio')).toBeInTheDocument())

    await userEvent.type(screen.getByRole('textbox'), 'Hujan')
    await waitFor(() => expect(screen.queryByText('Kopi Susu Studio')).toBeNull())
    expect(screen.getByText('Hujan Tinta')).toBeInTheDocument()
  })
})

describe('ticket wallet', () => {
  it('renders one QR per pass, encoding the pass qr_token and nothing else', async () => {
    signInAsAttendee()
    render(wrap(<TicketWallet />, '/wallet', '/wallet'))

    await waitFor(() =>
      expect(QRCodeGenerator.generateQRCode).toHaveBeenCalledWith(ticket_passes[0].qr_token),
    )
    // The paid order holds two passes — one QR per admitted head, not per order.
    expect(QRCodeGenerator.generateQRCode).toHaveBeenCalledWith(ticket_passes[1].qr_token)
    for (const call of vi.mocked(QRCodeGenerator.generateQRCode).mock.calls) {
      expect(call[0]).toMatch(/^[0-9a-f-]{36}$/)
    }
  })
})

describe('ticket checkout', () => {
  it('buys through the purchase_tickets RPC and never sends a price or a status', async () => {
    signInAsAttendee()
    const rpc = vi.spyOn(supabase, 'rpc')
    render(wrap(<TicketingSystem />, '/e/:eventId/tickets', `/e/${EVENT_ID}/tickets`))

    await waitFor(() => expect(screen.getByText('Two-Day Pass')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Add one Two-Day Pass/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /Check out/i })[0])

    await waitFor(() => expect(rpc).toHaveBeenCalled())
    const [name, args] = rpc.mock.calls[0]
    expect(name).toBe('purchase_tickets')
    expect(Object.keys(args as object).sort()).toEqual([
      'p_holder_names',
      'p_quantity',
      'p_ticket_id',
    ])
    expect(JSON.stringify(args)).not.toMatch(/price|payment_status/)
  })

  it('lists a sold-out tier with its stepper disabled instead of hiding it', async () => {
    signInAsAttendee()
    render(wrap(<TicketingSystem />, '/e/:eventId/tickets', `/e/${EVENT_ID}/tickets`))

    await waitFor(() => expect(screen.getByText('Early Bird — Day 1')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Add one Early Bird/i })).toBeDisabled()
  })
})
