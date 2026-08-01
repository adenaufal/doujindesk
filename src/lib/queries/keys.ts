/**
 * The query-key factory. Every key in the app is built here, so invalidation is
 * never a hand-typed string that quietly stops matching.
 *
 * Shape: `[surface, eventId?, …discriminators]`. The event id sits second on
 * purpose — `invalidateQueries({ queryKey: ['circles', eventId] })` then clears
 * every filtered variant of one event's circles and touches no other event.
 */
export const queryKeys = {
  events: {
    all: () => ['events'] as const,
    one: (eventId: string) => ['events', eventId] as const,
  },
  profiles: {
    one: (userId: string) => ['profiles', userId] as const,
  },
  circles: {
    list: (eventId: string, filters?: unknown) => ['circles', eventId, filters ?? null] as const,
    one: (circleId: string) => ['circles', 'one', circleId] as const,
    mine: (eventId: string, userId: string) => ['circles', eventId, 'mine', userId] as const,
    catalog: (eventId: string, filters?: unknown) =>
      ['circle_catalog', eventId, filters ?? null] as const,
  },
  booths: {
    list: (eventId: string) => ['booths', eventId] as const,
  },
  tickets: {
    list: (eventId: string) => ['tickets', eventId] as const,
  },
  purchases: {
    mine: (eventId: string, userId: string) => ['ticket_purchases', eventId, userId] as const,
    passes: (purchaseId: string) => ['ticket_passes', purchaseId] as const,
  },
  transactions: {
    list: (eventId: string) => ['financial_transactions', eventId] as const,
    summary: (eventId: string) => ['event_financial_summary', eventId] as const,
  },
  staff: {
    list: (eventId: string) => ['staff', eventId] as const,
    tasks: (eventId: string, filters?: unknown) =>
      ['staff_tasks', eventId, filters ?? null] as const,
  },
  queues: {
    list: (eventId: string) => ['queues', eventId] as const,
  },
  announcements: {
    list: (eventId: string, filters?: unknown) =>
      ['announcements', eventId, filters ?? null] as const,
  },
  notifications: {
    mine: (eventId: string, userId: string) => ['notifications', eventId, userId] as const,
  },
  schedule: {
    list: (eventId: string) => ['event_schedule', eventId] as const,
  },
  dashboard: {
    counters: (eventId: string) => ['event_counters', eventId] as const,
  },
} as const
