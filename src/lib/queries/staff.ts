import type { StaffRow, StaffStatus, StaffTaskRow, TaskStatus } from '../database.types'
import { supabase, useList, useWrite } from './core'
import { queryKeys } from './keys'

/** The roster. `staff.role` is an event-scoped job title, not the account role. */
export function useStaff(eventId: string | undefined) {
  return useList<StaffRow>(
    queryKeys.staff.list(eventId ?? ''),
    () =>
      supabase.from('staff').select('*').eq('event_id', eventId!).order('name', { ascending: true }),
    { enabled: Boolean(eventId) },
  )
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[]
  /** Only tasks whose `assigned_to` uuid[] contains this user. */
  assignedTo?: string
}

/**
 * `eventId` is optional because `/tasks` is not an event-scoped route: a staffer
 * opens their own task list before they have picked an event, and RLS already
 * limits the rows to events they are staff on. Pass an id from an organizer
 * screen; omit it for "my tasks, wherever they are".
 */
export function useStaffTasks(eventId: string | undefined, filters: TaskFilters = {}) {
  return useList<StaffTaskRow>(
    queryKeys.staff.tasks(eventId ?? 'all', filters),
    () => {
      let q = supabase.from('staff_tasks').select('*')
      if (eventId) q = q.eq('event_id', eventId)
      if (filters.status) {
        q = Array.isArray(filters.status) ? q.in('status', filters.status) : q.eq('status', filters.status)
      }
      // `assigned_to` is uuid[] with a GIN index — a containment filter, not a join.
      if (filters.assignedTo) q = q.contains('assigned_to', [filters.assignedTo])
      return q.order('due_at', { ascending: true })
    },
    { enabled: Boolean(eventId || filters.assignedTo) },
  )
}

export function useSaveTask(eventId: string) {
  return useWrite(
    async (values: Partial<StaffTaskRow> & { id?: string }) => {
      const payload = { ...values, event_id: eventId }
      const query = values.id
        ? supabase.from('staff_tasks').update(payload).eq('id', values.id)
        : supabase.from('staff_tasks').insert(payload)
      const { data, error } = await query.select().single()
      if (error) throw new Error(error.message)
      return data as StaffTaskRow
    },
    () => [queryKeys.staff.tasks(eventId)],
  )
}

/**
 * The assignee's own transition. 005 grants an assignee UPDATE on status and
 * notes and nothing else, so this writes nothing else — and it takes no event id,
 * because the staff task list is not event-scoped.
 */
export function useSetTaskStatus(userId: string | undefined) {
  return useWrite(
    async (args: { id: string; status: TaskStatus }) => {
      const done = args.status === 'completed'
      const { error } = await supabase
        .from('staff_tasks')
        .update({
          status: args.status,
          completed_at: done ? new Date().toISOString() : null,
          completed_by: done ? (userId ?? null) : null,
        })
        .eq('id', args.id)
      if (error) throw new Error(error.message)
      return args.id
    },
    // Every filtered variant of every event's task list — the caller may hold
    // several (my open tasks, my done tasks) and a status change moves a row
    // between them.
    () => [['staff_tasks']],
  )
}

export function useSetStaffStatus(eventId: string) {
  return useWrite(
    async (args: { id: string; status: StaffStatus }) => {
      const { error } = await supabase
        .from('staff')
        .update({ status: args.status })
        .eq('id', args.id)
      if (error) throw new Error(error.message)
      return args.id
    },
    () => [queryKeys.staff.list(eventId)],
  )
}

/**
 * Add someone who already has a DoujinDesk account to the roster.
 *
 * ponytail: this is the invite path that needs no server. A real email invitation
 * is `auth.admin.inviteUserByEmail`, which requires the service role key and
 * therefore a server route the runtime deliberately does not have (see P3 in
 * PROGRESS.md). Ceiling: the person must have signed up first. Upgrade path: one
 * `@vercel/node` handler next to the payment webhook, calling the admin API.
 */
export function useInviteStaff(eventId: string) {
  return useWrite(
    async (args: { email: string; role: StaffRow['role']; zones?: string[] }) => {
      const email = args.email.trim().toLowerCase()
      const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .eq('email', email)
        .maybeSingle()
      if (lookupError) throw new Error(lookupError.message)
      if (!profile) throw new Error('no-account')

      const { error } = await supabase.from('staff').insert({
        event_id: eventId,
        user_id: profile.id,
        name: profile.display_name ?? email,
        email,
        role: args.role,
        status: 'active',
        assigned_zones: args.zones ?? null,
      })
      if (error) throw new Error(error.message)
      return email
    },
    () => [queryKeys.staff.list(eventId)],
  )
}
