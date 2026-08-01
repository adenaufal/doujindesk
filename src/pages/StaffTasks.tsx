import { ClipboardList, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Async, Page, PageHeader } from '@/components/ops'
import { useDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSetTaskStatus, useStaffTasks } from '@/lib/queries'
import type { StaffTaskRow, TaskPriority } from '@/lib/database.types'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

/**
 * The staff side of tasks, at `/tasks`: one person, their own work, on a phone.
 *
 * Not a tab inside the organizer console — a staffer at Gate 3 opens this
 * between scans and needs the next thing to do above the fold. It is also not
 * event-scoped, because `/tasks` is where a staffer lands after signing in,
 * before they have chosen an event; `assigned_to @> [me]` plus RLS is the scope.
 *
 * 005 grants an assignee UPDATE on `status` and `notes` only, so those two
 * buttons are the whole write surface. Everything else here is read-only, and
 * an attempt to widen it fails at the database rather than in a disabled prop.
 */
export default function StaffTasks() {
  const { t } = useTranslation(['organizer', 'common'])
  const userId = useAuthStore((s) => s.user?.id)
  const dateTime = useDateTime()

  const tasks = useStaffTasks(undefined, { assignedTo: userId })
  const setStatus = useSetTaskStatus(userId)

  const open = tasks.data.filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
  const done = tasks.data.filter((task) => task.status === 'completed')

  return (
    <Page className="max-w-2xl">
      <PageHeader
        title={t('tasks.title')}
        description={t('tasks.subtitle', { count: open.length })}
      />

      <div className="mt-6">
        <Async
          state={tasks}
          icon={ClipboardList}
          emptyTitle={t('tasks.empty')}
          emptyDescription={t('tasks.emptyBody')}
        >
          <ul className="space-y-3">
            {open.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                dateTime={dateTime}
                onStatus={(status) => setStatus.mutate({ id: task.id, status })}
              />
            ))}
          </ul>

          {done.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {t('tasks.done', { count: done.length })}
              </h2>
              <ul className="mt-3 space-y-3">
                {done.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    dateTime={dateTime}
                    onStatus={(status) => setStatus.mutate({ id: task.id, status })}
                  />
                ))}
              </ul>
            </section>
          )}
        </Async>
      </div>
    </Page>
  )
}

const PRIORITY_VARIANT: Record<TaskPriority, 'danger' | 'warning' | 'info' | 'outline'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'outline',
}

function TaskCard({
  task,
  dateTime,
  onStatus,
}: {
  task: StaffTaskRow
  dateTime: (iso: string | null) => string
  onStatus: (status: StaffTaskRow['status']) => void
}) {
  const { t } = useTranslation(['organizer', 'common'])
  const complete = task.status === 'completed'
  const overdue = !complete && task.due_at !== null && Date.parse(task.due_at) < Date.now()

  return (
    <li
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        complete && 'opacity-70',
        overdue && 'border-destructive/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-card-foreground text-pretty">{task.title}</h3>
        <Badge variant={PRIORITY_VARIANT[task.priority]}>
          {t(`staff.priority.${task.priority}`)}
        </Badge>
      </div>

      {task.description ? (
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{task.description}</p>
      ) : null}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className={cn('tabular-nums', overdue && 'font-medium text-destructive')}>
          {overdue ? t('tasks.overdue', { when: dateTime(task.due_at) }) : dateTime(task.due_at)}
        </span>
        {task.location ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {task.location}
          </span>
        ) : null}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(`staff.taskStatus.${task.status}`)}</Badge>
        <span className="flex-1" />
        {task.status === 'pending' && (
          <Button variant="outline" className="coarse:min-h-11" onClick={() => onStatus('in_progress')}>
            {t('tasks.start')}
          </Button>
        )}
        {!complete && (
          <Button className="coarse:min-h-11" onClick={() => onStatus('completed')}>
            {t('tasks.complete')}
          </Button>
        )}
        {complete && (
          <Button
            variant="outline"
            className="coarse:min-h-11"
            onClick={() => onStatus('in_progress')}
          >
            {t('tasks.reopen')}
          </Button>
        )}
      </div>
    </li>
  )
}
