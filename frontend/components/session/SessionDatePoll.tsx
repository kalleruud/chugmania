import ConfirmationButton from '@/components/ConfirmationButton'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { editSession } from '@/lib/session-utils'
import loc from '@common/locale/locales'
import { isDatePollOpen, type SessionWithSignups } from '@common/models/session'
import { formatDateWithYear } from '@common/utils/date'
import { CalendarDaysIcon, CheckIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import SessionUserGroup from './SessionUserGroup'

export default function SessionDatePoll({
  session,
}: Readonly<{ session: SessionWithSignups }>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()
  const [detailsDate, setDetailsDate] = useState<number>()
  const [selectedDate, setSelectedDate] = useState<string>()
  const canEdit = isLoggedIn && loggedInUser.role !== 'user'
  const options = (session.dateOptions ?? []).toSorted((a, b) => a - b)
  const chosenDate = options.find(date => String(date) === selectedDate)

  const myDates = (
    session.dateVotes.find(v => isLoggedIn && v.user.id === loggedInUser.id)
      ?.dates ?? []
  ).filter(date => options.includes(date))
  const respondents = session.dateVotes.filter(v =>
    v.dates.some(date => options.includes(date))
  )
  const voters = (date: number) =>
    respondents.filter(v => v.dates.includes(date)).map(v => v.user)
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

  function chooseDate() {
    if (chosenDate === undefined) return
    editSession(
      socket,
      session.id,
      {
        date: new Date(chosenDate),
        dateVotingClosed: true,
        status: 'confirmed',
      },
      loc.no.session.datePoll.chooseRequest
    )
  }

  return (
    <div className='flex flex-col gap-2 rounded-sm border bg-background p-2'>
      <div className='flex items-start justify-between gap-2 px-2 pt-2'>
        <div className='flex flex-col gap-1'>
          <h3>{loc.no.session.datePoll.title}</h3>
          <p className='text-sm text-muted-foreground'>
            {loc.no.session.datePoll.subtitle}
          </p>
        </div>
        {canEdit && <DateOptionsDialog session={session} />}
      </div>

      {options.map(date => {
        const dateVoters = voters(date)
        const isSelected = myDates.includes(date)
        const isTop = maxVotes > 0 && dateVoters.length === maxVotes
        const percent =
          respondents.length > 0
            ? Math.round((dateVoters.length / respondents.length) * 100)
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
            <button
              type='button'
              className='flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-sm text-start focus-visible:outline-2 focus-visible:outline-primary'
              onClick={() => setDetailsDate(date)}>
              <span className='flex-1 truncate capitalize'>
                {formatDateWithYear(new Date(date))}
              </span>
              <span className='text-sm text-muted-foreground tabular-nums'>
                {loc.no.session.datePoll.votes(dateVoters.length)}
              </span>
              <span className='w-10 text-end text-sm tabular-nums'>
                {percent}%
              </span>
            </button>
          </div>
        )
      })}

      {canEdit && (
        <div className='flex flex-col gap-2 border-t px-2 pt-3 pb-1'>
          <div className='flex items-center gap-2'>
            <Select
              value={String(chosenDate ?? '')}
              onValueChange={setSelectedDate}>
              <SelectTrigger
                className='min-w-0 flex-1'
                aria-label={loc.no.session.datePoll.choosePlaceholder}>
                <SelectValue
                  placeholder={loc.no.session.datePoll.choosePlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {options.map(date => (
                  <SelectItem key={date} value={String(date)}>
                    <span className='capitalize'>
                      {formatDateWithYear(new Date(date))}
                    </span>
                    <span className='text-muted-foreground'>
                      {loc.no.session.datePoll.votes(voters(date).length)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ConfirmationButton
              disabled={chosenDate === undefined}
              onClick={chooseDate}>
              {loc.no.session.datePoll.choose}
            </ConfirmationButton>
          </div>
          <p className='text-sm text-muted-foreground'>
            {loc.no.session.datePoll.chooseHint}
          </p>
        </div>
      )}

      <DateDetailsDialog
        date={detailsDate}
        votes={session.dateVotes}
        onClose={() => setDetailsDate(undefined)}
      />
    </div>
  )
}

function DateDetailsDialog({
  date,
  votes,
  onClose,
}: Readonly<{
  date: number | undefined
  votes: SessionWithSignups['dateVotes']
  onClose: () => void
}>) {
  if (date === undefined) return undefined

  const canAttend = votes.filter(v => v.dates.includes(date))
  const cannotAttend = votes.filter(v => !v.dates.includes(date))
  const groups = [
    { title: loc.no.session.datePoll.canAttend, votes: canAttend },
    { title: loc.no.session.datePoll.cannotAttend, votes: cannotAttend },
  ]

  return (
    <Dialog
      open
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='capitalize'>
            {formatDateWithYear(new Date(date))}
          </DialogTitle>
          <DialogDescription>
            {loc.no.session.datePoll.votes(canAttend.length)}
          </DialogDescription>
        </DialogHeader>
        {groups.map(({ title, votes }) => (
          <SessionUserGroup
            key={title}
            title={title}
            items={votes.map(({ user }) => ({ key: user.id, user }))}
          />
        ))}
      </DialogContent>
    </Dialog>
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

  const isPollOpen = isDatePollOpen(session)

  function handleSave() {
    const time = new Date(session.date ?? options.at(0) ?? Date.now())
    const dates = selected.map(day => {
      const existing = options.find(
        option => new Date(option).toDateString() === day.toDateString()
      )
      if (existing !== undefined) return existing
      const date = new Date(day)
      date.setHours(time.getHours(), time.getMinutes(), 0, 0)
      return date.getTime()
    })
    setOpen(false)
    if (dates.length === 0 && !isPollOpen) return
    editSession(
      socket,
      session.id,
      {
        date: null,
        status: 'tentative',
        dateOptions: dates,
        dateVotingClosed: false,
      },
      loc.no.session.datePoll.saveRequest
    )
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
            {!isPollOpen && ` ${loc.no.session.datePoll.warning}`}
          </DialogDescription>
        </DialogHeader>
        <Calendar
          className='mx-auto'
          mode='multiple'
          showOutsideDays
          showWeekNumber
          weekStartsOn={1}
          defaultMonth={selected[0]}
          disabled={{ before: new Date() }}
          selected={selected}
          onSelect={days => setSelected(days ?? [])}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>{loc.no.common.cancel}</Button>
          </DialogClose>
          <Button
            disabled={isPollOpen && selected.length === 0}
            onClick={handleSave}>
            {loc.no.common.continue}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
