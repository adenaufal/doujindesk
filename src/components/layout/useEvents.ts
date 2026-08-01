import { useCallback, useEffect, useState } from 'react'

// -----------------------------------------------------------------------------
// The shell's event list: the sidebar switcher and the `/` event chooser both
// need it and nothing else does yet.
//
// ponytail: a hand-rolled fetch instead of a TanStack Query hook, because
// P9-data-layer owns `src/lib/queries/` and mounts the QueryClientProvider —
// neither exists yet, so `useQuery` here would throw. Upgrade path: delete this
// file and import `useEvents` from `@/lib/queries/events` once P9 lands.
//
// RLS (migration 002) already hides draft events from anon, so this is the same
// query for a signed-out attendee and a signed-in organizer.
// -----------------------------------------------------------------------------

export interface EventSummary {
  id: string
  name: string
  start_date: string
  end_date: string
  venue_name: string | null
  status: string
  currency: string
}

interface EventsState {
  events: EventSummary[]
  loading: boolean
  error: string | null
}

export function useEvents() {
  const [state, setState] = useState<EventsState>({ events: [], loading: true, error: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('events')
        .select('id, name, start_date, end_date, venue_name, status, currency')
        .order('start_date', { ascending: false })
      if (error) throw new Error(error.message)
      setState({ events: (data ?? []) as EventSummary[], loading: false, error: null })
    } catch (err) {
      setState({
        events: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Could not load events',
      })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, reload: load }
}

/** Anything that has not finished yet is "upcoming"; the rest is "past". */
export function splitEvents(events: readonly EventSummary[], now = Date.now()) {
  const upcoming: EventSummary[] = []
  const past: EventSummary[] = []
  for (const event of events) {
    ;(Date.parse(event.end_date) >= now ? upcoming : past).push(event)
  }
  // Upcoming reads soonest-first; past reads most-recent-first.
  upcoming.sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date))
  return { upcoming, past }
}

export function formatEventDates(event: EventSummary, locale: string) {
  const start = new Date(event.start_date)
  const end = new Date(event.end_date)
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  return start.toDateString() === end.toDateString()
    ? fmt.format(start)
    : `${fmt.format(start)} – ${fmt.format(end)}`
}
