import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import CircleApplicationForm from './CircleApplicationForm'
// Side-effect import: without it react-i18next renders raw keys and every
// label query below misses.
import '@/lib/i18n'
import { tables } from '@/lib/demo/store'
import { EVENT_ID_TOKYO, USER } from '@/lib/fixtures'
import { useAuthStore } from '@/stores/authStore'

/**
 * Criterion 7 — "circle application submit + validation".
 *
 * These run against the demo client (fixtures in memory), not against a
 * hand-mocked PostgREST builder: mocking the fluent chain encodes call order and
 * breaks on a harmless refactor, while the demo store lets the test assert the
 * thing that actually matters — the exact columns the row was written with. The
 * old form spread ~15 non-columns into `circles`; only an assertion on the
 * written row catches that coming back.
 *
 * The Tokyo event is used because no fixture circle belongs to it, so the form
 * starts blank.
 */

const CIRCLE_USER = {
  id: USER.circle,
  email: 'kopisusu.studio@gmail.com',
  name: 'Kopi Susu Studio',
  avatarUrl: null,
  role: 'circle',
}

function circlesFor(name: string) {
  return tables.circles.filter((c) => c.circle_name === name)
}

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/e/${EVENT_ID_TOKYO}/apply`]}>
        <CircleApplicationForm eventId={EVENT_ID_TOKYO} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** The list query resolves before the form replaces its skeleton. */
const nameField = () => screen.findByLabelText(/circle name \*/i)

/** Everything the schema demands except the circle name and its reading. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>, circleName: string) {
  await user.type(await nameField(), circleName)
  await user.type(screen.getByLabelText(/pen name \*/i), 'Naya')
  // The form prefills the signed-in account's email; replace it rather than
  // typing on top of it.
  await user.clear(screen.getByLabelText(/email \*/i))
  await user.type(screen.getByLabelText(/email \*/i), 'naya@example.com')
  await user.type(screen.getByLabelText(/about your circle \*/i), 'Riso-printed short comics.')
  await user.click(screen.getByRole('button', { name: 'doujinshi' }))
  // Genre is a Radix Select; the listbox is portalled and opened on pointerdown.
  await user.click(screen.getByRole('combobox', { name: /genre/i }))
  await user.click(await screen.findByRole('option', { name: 'Original' }))
}

const submit = () => screen.getByRole('button', { name: /submit application/i })

beforeAll(() => {
  // jsdom ships none of these, and Radix Select plus the file preview need them.
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  URL.createObjectURL ??= vi.fn(() => 'blob:preview')
  URL.revokeObjectURL ??= vi.fn()
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  useAuthStore.setState({ user: CIRCLE_USER, role: 'circle', loading: false, error: null })
  // The demo store is module state shared by the whole file, and each test here
  // writes a draft. Without this, test 3 resumes test 2's draft.
  tables.circles = tables.circles.filter((c) => c.event_id !== EVENT_ID_TOKYO)
})

describe('CircleApplicationForm', () => {
  it('blocks submit until the required fields are filled', { timeout: 20_000 }, async () => {
    const user = userEvent.setup({ delay: null })
    renderForm()

    await nameField()
    await user.click(submit())

    await waitFor(() =>
      expect(screen.getByLabelText(/circle name \*/i)).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(tables.circles.some((c) => c.event_id === EVENT_ID_TOKYO)).toBe(false)
  })

  it('requires furigana when the circle name is written in Japanese', { timeout: 20_000 }, async () => {
    const user = userEvent.setup({ delay: null })
    renderForm()

    await fillRequired(user, '猫町堂')
    await user.click(submit())

    expect(await screen.findByText(/Add the kana reading/i)).toBeInTheDocument()
    expect(circlesFor('猫町堂').filter((c) => c.event_id === EVENT_ID_TOKYO)).toHaveLength(0)
  })

  it('submits a Latin-named circle with no furigana, mapped to real columns', { timeout: 20_000 }, async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = renderForm()

    await fillRequired(user, 'Studio Kelinci')
    await user.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['cut'], 'cut.png', { type: 'image/png' }),
    )
    await user.click(submit())

    const row = await waitFor(() => {
      const found = circlesFor('Studio Kelinci').find((c) => c.application_status === 'submitted')
      expect(found).toBeTruthy()
      return found!
    })

    // The columns the old code got wrong, in one assertion.
    expect(row.user_id).toBe(USER.circle)
    expect(row.event_id).toBe(EVENT_ID_TOKYO)
    expect(row.space_type).toBe('circle_space_1')
    expect(row.circle_cut_file_url).toBeTruthy()
    expect(row.product_types).toEqual(['doujinshi'])
    // Phantoms that are not columns in any migration. If one of these comes
    // back, PostgREST answers PGRST204 and no application can be filed.
    for (const phantom of ['space_preference', 'space_size', 'currency', 'twitter', 'website']) {
      expect(row[phantom]).toBeUndefined()
    }
    // The organizer allocates the code; a draft has none (005 dropped NOT NULL).
    expect(row.circle_code ?? null).toBeNull()
  })

  it('saves a draft while typing, without submitting it', { timeout: 20_000 }, async () => {
    const user = userEvent.setup({ delay: null })
    renderForm()

    await user.type(await nameField(), 'Warung Riso')

    const row = await waitFor(
      () => {
        const found = circlesFor('Warung Riso')[0]
        expect(found).toBeTruthy()
        return found!
      },
      { timeout: 4000 },
    )

    expect(row.application_status).toBe('draft')
    expect(row.user_id).toBe(USER.circle)
  })
})
