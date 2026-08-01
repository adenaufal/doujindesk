import type { StaffRow, StaffTaskRow, TaskStatus } from '../database.types'
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

export function useStaffTasks(eventId: string | undefined, filters: TaskFilters = {}) {
  return useList<StaffTaskRow>(
    queryKeys.staff.tasks(eventId ?? '', filters),
    () => {
      let q = supabase.from('staff_tasks').select('*').eq('event_id', eventId!)
      if (filters.status) {
        q = Array.isArray(filters.status) ? q.in('status', filters.status) : q.eq('status', filters.status)
      }
      // `assigned_to` is uuid[] with a GIN index — a containment filter, not a join.
      if (filters.assignedTo) q = q.contains('assigned_to', [filters.assignedTo])
      return q.order('due_at', { ascending: true })
    },
    { enabled: Boolean(eventId) },
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
