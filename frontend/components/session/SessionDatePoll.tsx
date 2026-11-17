import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import type {
  EditSessionRequest,
  SessionWithSignups,
} from '@common/models/session'
import { getUserFullName } from '@common/models/user'
import { formatDateWithYear } from '@common/utils/date'
import { CalendarDaysIcon, CheckIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'

type SessionEdit = Omit<EditSessionRequest, 'type' | 'id'>

function editSession(
  socket: ReturnType<typeof useConnection>['socket'],
  id: string,
  edit: SessionEdit
) {
  const request = socket
    .emitWithAck('edit_session', { type: 'EditSessionRequest', id, ...edit })
    .then(r => {
      if (!r.success) throw new Error(r.message)
    })
  return toast.promise(request, loc.no.session.editRequest)
}

export default function SessionDatePoll({
  session,
}: Readonly<{ session: SessionWithSignups }>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()
  const canEdit = isLoggedIn && loggedInUser.role !== 'user'
  const options = (session.dateOptions ?? []).toSorted((a, b) => a - b)

  if (options.length === 0 || session.dateVotingClosed) return undefined

  const myDates = (
    session.dateVotes.find(v => isLoggedIn && v.user.id === loggedInUser.id)
      ?.dates ?? []
  ).filter(date => options.includes(date))
  const voters = (date: number) =>
    session.dateVotes.filter(v => v.dates.includes(date)).map(v => v.user)
  const maxVotes = Math.max(0, ...options.map(date => voters(date).length))
  const respondents = session.dateVotes.filter(v =>
    v.dates.some(date => options.includes(date))
  ).length

  async function emitVote(dates: number[]) {
    const r = await socket.emitWithAck('vote_session_date', {
      type: 'VoteSessionDateRequest',
      session: session.id,
      dates,
    })
    if (!r.success) throw new Error(r.message)
  }

  function toggleVote(date: number) {
    const dates = myDates.includes(date)
      ? myDates.filter(d => d !== date)
      : [...myDates, date]
    toast.promise(emitVote(dates), loc.no.session.datePoll.voteRequest)
  }

  return (
    <div className='flex flex-col gap-2 rounded-sm border bg-background p-2'>
      <h3 className='px-2 pt-2'>{loc.no.session.datePoll.title}</h3>

      {options.map(date => {
        const dateVoters = voters(date)
        const isSelected = myDates.includes(date)
        const isTop = maxVotes > 0 && dateVoters.length === maxVotes
        const percent =
          respondents > 0
            ? Math.round((dateVoters.length / respondents) * 100)
            : 0
        return (
          <div
            key={date}
            className={twMerge(
              'relative isolate flex items-center gap-2 overflow-hidden rounded-sm border bg-background-secondary p-2',
              isTop && 'border-primary'
            )}>
            <div
              className={twMerge(
                'absolute inset-y-0 left-0 -z-10 bg-muted-foreground/15 transition-[width]',
                isTop && 'bg-primary/25'
              )}
              style={{ width: `${percent}%` }}
            />
            <Button
              size='icon'
              variant={isSelected ? 'default' : 'outline'}
              aria-label={formatDateWithYear(new Date(date))}
              aria-pressed={isSelected}
              disabled={!isLoggedIn}
              onClick={() => toggleVote(date)}>
              {isSelected && <CheckIcon />}
            </Button>
            <div className='flex min-w-0 flex-1 flex-col'>
              <span className='capitalize'>
                {formatDateWithYear(new Date(date))}
              </span>
              <span className='truncate text-sm text-muted-foreground'>
                {loc.no.session.datePoll.votes(dateVoters.length)}
                {dateVoters.length > 0 &&
                  `: ${dateVoters.map(getUserFullName).join(', ')}`}
              </span>
            </div>
            <span className='text-sm tabular-nums'>{percent}%</span>
            {canEdit && (
              <Button
                size='sm'
                variant='outline'
                onClick={() =>
                  editSession(socket, session.id, {
                    date: new Date(date),
                    dateVotingClosed: true,
                    status: 'confirmed',
                  })
                }>
                {loc.no.session.datePoll.choose}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DateOptionsDialog({
  session,
}: Readonly<{ session: SessionWithSignups }>) {
  const { socket } = useConnection()
  const options = session.dateOptions ?? []
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Date[]>([])

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen) setSelected(options.map(date => new Date(date)))
  }

  function handleSave() {
    const time = new Date(session.date)
    const dates = selected.map(day => {
      const existing = options.find(
        option => new Date(option).toDateString() === day.toDateString()
      )
      if (existing !== undefined) return existing
      const date = new Date(day)
      date.setHours(time.getHours(), time.getMinutes(), 0, 0)
      return date.getTime()
    })
    editSession(socket, session.id, {
      dateOptions: dates.length > 0 ? dates : null,
      dateVotingClosed: false,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline'>
          <CalendarDaysIcon />
          {loc.no.session.datePoll.edit}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.session.datePoll.edit}</DialogTitle>
          <DialogDescription>
            {loc.no.session.datePoll.description}
          </DialogDescription>
        </DialogHeader>
        <Calendar
          className='mx-auto'
          mode='multiple'
          showOutsideDays
          showWeekNumber
          weekStartsOn={1}
          defaultMonth={selected[0]}
          selected={selected}
          onSelect={days => setSelected(days ?? [])}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>{loc.no.common.cancel}</Button>
          </DialogClose>
          <Button onClick={handleSave}>{loc.no.common.continue}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
