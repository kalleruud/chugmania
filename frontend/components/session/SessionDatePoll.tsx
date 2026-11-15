import { Badge } from '@/components/ui/badge'
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
import { formatDateWithYear, formatTimeOnly } from '@common/utils/date'
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
  const isOpen = !session.dateVotingClosed

  if (options.length === 0) return undefined

  const myDates = (
    session.dateVotes.find(v => isLoggedIn && v.user.id === loggedInUser.id)
      ?.dates ?? []
  ).filter(date => options.includes(date))
  const voters = (date: number) =>
    session.dateVotes.filter(v => v.dates.includes(date)).map(v => v.user)
  const maxVotes = Math.max(0, ...options.map(date => voters(date).length))

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
      <div className='flex items-center gap-2 px-2 pt-2'>
        <h3 className='flex-1'>{loc.no.session.datePoll.title}</h3>
        <Badge variant={isOpen ? 'default' : 'secondary'}>
          {isOpen
            ? loc.no.session.datePoll.open
            : loc.no.session.datePoll.closed}
        </Badge>
        {canEdit && (
          <Button
            size='sm'
            variant='outline'
            onClick={() =>
              editSession(socket, session.id, { dateVotingClosed: isOpen })
            }>
            {isOpen
              ? loc.no.session.datePoll.close
              : loc.no.session.datePoll.reopen}
          </Button>
        )}
      </div>

      {options.map(date => {
        const dateVoters = voters(date)
        const isSelected = myDates.includes(date)
        const isTop = maxVotes > 0 && dateVoters.length === maxVotes
        return (
          <div
            key={date}
            className={twMerge(
              'flex items-center gap-2 rounded-sm border bg-background-secondary p-2',
              isTop && 'border-primary'
            )}>
            <Button
              size='icon'
              variant={isSelected ? 'default' : 'outline'}
              aria-label={formatDateWithYear(new Date(date))}
              aria-pressed={isSelected}
              disabled={!isLoggedIn || !isOpen}
              onClick={() => toggleVote(date)}>
              {isSelected && <CheckIcon />}
            </Button>
            <div className='flex min-w-0 flex-1 flex-col'>
              <span className='capitalize'>
                {formatDateWithYear(new Date(date))}{' '}
                <span className='text-muted-foreground'>
                  {formatTimeOnly(new Date(date))}
                </span>
              </span>
              <span className='truncate text-sm text-muted-foreground'>
                {loc.no.session.datePoll.votes(dateVoters.length)}
                {dateVoters.length > 0 &&
                  `: ${dateVoters.map(getUserFullName).join(', ')}`}
              </span>
            </div>
            {canEdit && (
              <Button
                size='sm'
                variant='outline'
                onClick={() =>
                  editSession(socket, session.id, {
                    date: new Date(date),
                    dateVotingClosed: true,
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
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant='outline'>
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
