import { useState } from 'react'
import { ClipboardList, Plus, UserPlus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Async, Page, PageHeader } from '@/components/ops'
import { initials, useDateTime } from '@/lib/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useInviteStaff,
  useSaveTask,
  useSetStaffStatus,
  useSetTaskStatus,
  useStaff,
  useStaffTasks,
} from '@/lib/queries'
import type { StaffRole, StaffRow, StaffStatus, StaffTaskRow, TaskPriority } from '@/lib/database.types'
import { useAuthStore } from '@/stores/authStore'

/**
 * The organizer's view of who is working and what they are doing.
 *
 * Scoped to what the brief asks for: a roster and a task board. The Incidents
 * and Messages tabs are gone — an internal chat system is explicitly outside the
 * scope fence, and incident tracking with it (both recorded under Deferred in
 * PROGRESS.md). `staff.status` values are the DB CHECK domain
 * (`active|inactive|on_break`), not the store's Title Case.
 *
 * The staff-side companion is `src/pages/StaffTasks.tsx` at `/tasks`, which is
 * phone-shaped and shows one person their own work.
 */
export default function StaffCoordination() {
  const { t } = useTranslation(['organizer', 'common'])
  const { eventId } = useParams()

  return (
    <Page>
      <PageHeader title={t('staff.title')} description={t('staff.subtitle')} />

      <Tabs defaultValue="roster" className="mt-6">
        <TabsList>
          <TabsTrigger value="roster" className="coarse:min-h-11">
            {t('staff.roster')}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="coarse:min-h-11">
            {t('staff.tasks')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4">
          <Roster eventId={eventId} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TaskBoard eventId={eventId} />
        </TabsContent>
      </Tabs>
    </Page>
  )
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

const STAFF_STATUSES: StaffStatus[] = ['active', 'on_break', 'inactive']
const STAFF_ROLES: StaffRole[] = ['coordinator', 'scanner', 'volunteer', 'organizer']

const STATUS_VARIANT: Record<StaffStatus, 'success' | 'warning' | 'outline'> = {
  active: 'success',
  on_break: 'warning',
  inactive: 'outline',
}

function Roster({ eventId }: { eventId: string | undefined }) {
  const { t } = useTranslation(['organizer', 'common'])
  const roster = useStaff(eventId)
  const setStatus = useSetStaffStatus(eventId ?? '')
  const [inviteOpen, setInviteOpen] = useState(false)

  const onDuty = roster.data.filter((member) => member.status === 'active').length

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t('staff.onDuty', { count: onDuty, total: roster.data.length })}
        </p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          {t('staff.invite')}
        </Button>
      </div>

      <div className="mt-3">
        <Async
          state={roster}
          icon={Users}
          emptyTitle={t('staff.rosterEmpty')}
          emptyDescription={t('staff.rosterEmptyBody')}
          emptyAction={<Button onClick={() => setInviteOpen(true)}>{t('staff.invite')}</Button>}
        >
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {roster.data.map((member) => (
              <RosterRow
                key={member.id}
                member={member}
                onStatus={(status) => setStatus.mutate({ id: member.id, status })}
              />
            ))}
          </ul>
        </Async>
      </div>

      <InviteDialog eventId={eventId} open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  )
}

function RosterRow({
  member,
  onStatus,
}: {
  member: StaffRow
  onStatus: (status: StaffStatus) => void
}) {
  const { t } = useTranslation(['organizer', 'common'])

  return (
    <li className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
      <Avatar className="size-9 shrink-0">
        <AvatarFallback>{initials(member.name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-card-foreground">{member.name}</p>
        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline">{t(`staff.roleOption.${member.role}`)}</Badge>
          {member.assigned_zones?.length ? <span>{member.assigned_zones.join(' · ')}</span> : null}
          {member.shift_start && member.shift_end ? (
            <span className="tabular-nums">
              {member.shift_start}–{member.shift_end}
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={STATUS_VARIANT[member.status]}>
          {t(`staff.statusOption.${member.status}`)}
        </Badge>
        <Select value={member.status} onValueChange={(value) => onStatus(value as StaffStatus)}>
          <SelectTrigger className="w-36 coarse:min-h-11" aria-label={t('staff.changeStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAFF_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`staff.statusOption.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  )
}

function InviteDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation(['organizer', 'common'])
  const invite = useInviteStaff(eventId ?? '')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('scanner')

  const submit = (formEvent: React.FormEvent) => {
    formEvent.preventDefault()
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          toast.success(t('staff.inviteAdded', { email }))
          setEmail('')
          onOpenChange(false)
        },
        onError: (error) =>
          toast.error(
            error.message === 'no-account' ? t('staff.inviteNoAccount') : t('common:error.generic'),
          ),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('staff.invite')}</DialogTitle>
            <DialogDescription>{t('staff.inviteHint')}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">{t('staff.inviteEmail')}</Label>
              <Input
                id="invite-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gate3@comicfrontier.id"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">{t('staff.role')}</Label>
              <Select value={role} onValueChange={(value) => setRole(value as StaffRole)}>
                <SelectTrigger id="invite-role" className="coarse:min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`staff.roleOption.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? t('common:status.saving') : t('staff.invite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical']

const PRIORITY_VARIANT: Record<TaskPriority, 'danger' | 'warning' | 'info' | 'outline'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'outline',
}

function TaskBoard({ eventId }: { eventId: string | undefined }) {
  const { t } = useTranslation(['organizer', 'common'])
  const userId = useAuthStore((s) => s.user?.id)
  const tasks = useStaffTasks(eventId)
  const roster = useStaff(eventId)
  const setStatus = useSetTaskStatus(userId)
  const [composeOpen, setComposeOpen] = useState(false)
  const dateTime = useDateTime()

  const nameFor = (ids: string[]) =>
    ids
      .map((id) => roster.data.find((member) => member.user_id === id)?.name)
      .filter(Boolean)
      .join(', ')

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t('staff.openTasks', {
            count: tasks.data.filter((task) => task.status !== 'completed').length,
          })}
        </p>
        <Button onClick={() => setComposeOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('staff.addTask')}
        </Button>
      </div>

      <div className="mt-3">
        <Async
          state={tasks}
          icon={ClipboardList}
          emptyTitle={t('staff.tasksEmpty')}
          emptyDescription={t('staff.tasksEmptyBody')}
          emptyAction={<Button onClick={() => setComposeOpen(true)}>{t('staff.addTask')}</Button>}
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {tasks.data.map((task) => (
              <li
                key={task.id}
                className="flex flex-col rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-card-foreground text-pretty">{task.title}</h3>
                  <Badge variant={PRIORITY_VARIANT[task.priority]}>
                    {t(`staff.priority.${task.priority}`)}
                  </Badge>
                </div>
                {task.description ? (
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">
                    {task.description}
                  </p>
                ) : null}
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <dt>{t('staff.due')}</dt>
                  <dd className="tabular-nums">{dateTime(task.due_at)}</dd>
                  <dt>{t('staff.assignee')}</dt>
                  <dd>{nameFor(task.assigned_to) || t('staff.unassigned')}</dd>
                  {task.location ? (
                    <>
                      <dt>{t('staff.location')}</dt>
                      <dd>{task.location}</dd>
                    </>
                  ) : null}
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline">{t(`staff.taskStatus.${task.status}`)}</Badge>
                  <span className="flex-1" />
                  {task.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ id: task.id, status: 'completed' })}
                    >
                      {t('staff.complete')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Async>
      </div>

      <TaskDialog
        eventId={eventId}
        roster={roster.data}
        open={composeOpen}
        onOpenChange={setComposeOpen}
      />
    </>
  )
}

function TaskDialog({
  eventId,
  roster,
  open,
  onOpenChange,
}: {
  eventId: string | undefined
  roster: StaffRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation(['organizer', 'common'])
  const userId = useAuthStore((s) => s.user?.id)
  const save = useSaveTask(eventId ?? '')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueAt, setDueAt] = useState('')
  const [location, setLocation] = useState('')
  const [assignee, setAssignee] = useState('')

  const submit = (formEvent: React.FormEvent) => {
    formEvent.preventDefault()
    const values: Partial<StaffTaskRow> = {
      title: title.trim(),
      priority,
      status: 'pending',
      category: 'operations',
      // `datetime-local` has no zone; the browser's own zone is the venue's.
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      location: location.trim() || null,
      assigned_to: assignee ? [assignee] : [],
      created_by: userId ?? null,
    }
    save.mutate(values, {
      onSuccess: () => {
        toast.success(t('staff.taskAdded'))
        setTitle('')
        setDueAt('')
        setLocation('')
        setAssignee('')
        onOpenChange(false)
      },
      onError: () => toast.error(t('common:error.generic')),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('staff.addTask')}</DialogTitle>
            <DialogDescription>{t('staff.addTaskHint')}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">{t('staff.taskTitle')}</Label>
              <Input
                id="task-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-priority">{t('staff.priorityLabel')}</Label>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as TaskPriority)}
                >
                  <SelectTrigger id="task-priority" className="coarse:min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`staff.priority.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due">{t('staff.due')}</Label>
                {/* Native picker: correct on every phone, zero dependency. */}
                <Input
                  id="task-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-location">{t('staff.location')}</Label>
                <Input
                  id="task-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Gate 3"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-assignee">{t('staff.assignee')}</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger id="task-assignee" className="coarse:min-h-11">
                    <SelectValue placeholder={t('staff.unassigned')} />
                  </SelectTrigger>
                  <SelectContent>
                    {roster.map((member) => (
                      <SelectItem key={member.id} value={member.user_id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending || !title.trim()}>
              {save.isPending ? t('common:status.saving') : t('common:action.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
