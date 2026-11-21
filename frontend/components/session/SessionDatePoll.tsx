import ConfirmationButton from '@/components/ConfirmationButton'
import { PageSubheader } from '@/components/PageHeader'
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
import { Empty } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import UserRow from '@/components/user/UserRow'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import {
  isDatePollOpen,
  type EditSessionRequest,
  type SessionWithSignups,
} from '@common/models/session'
import type { UserInfo } from '@common/models/user'
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
  const [detailsDate, setDetailsDate] = useState<number>()
  const [selectedDate, setSelectedDate] = useState<string>()
  const canEdit = isLoggedIn && loggedInUser.role !== 'user'
  const options = (session.dateOptions ?? []).toSorted((a, b) => a - b)
  const chosenDate = options.includes(Number(selectedDate))
    ? selectedDate
    : undefined

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
    if (!chosenDate) return
    editSession(socket, session.id, {
      date: new Date(Number(chosenDate)),
      dateVotingClosed: true,
      status: 'confirmed',
    })
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
              <span className='text-sm tabular-nums'>{percent}%</span>
            </button>
          </div>
        )
      })}

      {canEdit && (
        <div className='flex items-center gap-2 border-t px-2 pt-3 pb-1'>
          <Select value={chosenDate ?? ''} onValueChange={setSelectedDate}>
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
          <ConfirmationButton disabled={!chosenDate} onClick={chooseDate}>
            {loc.no.session.datePoll.choose}
          </ConfirmationButton>
        </div>
      )}

      <DateDetailsDialog
        date={detailsDate}
        canAttend={detailsDate === undefined ? [] : voters(detailsDate)}
        cannotAttend={session.dateVotes
          .filter(
            v => detailsDate === undefined || !v.dates.includes(detailsDate)
          )
          .map(v => v.user)}
        onClose={() => setDetailsDate(undefined)}
      />
    </div>
  )
}

function DateDetailsDialog({
  date,
  canAttend,
  cannotAttend,
  onClose,
}: Readonly<{
  date: number | undefined
  canAttend: UserInfo[]
  cannotAttend: UserInfo[]
  onClose: () => void
}>) {
  const groups = [
    { title: loc.no.session.datePoll.canAttend, users: canAttend },
    { title: loc.no.session.datePoll.cannotAttend, users: cannotAttend },
  ]
  return (
    <Dialog
      open={date !== undefined}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='capitalize'>
            {date !== undefined && formatDateWithYear(new Date(date))}
          </DialogTitle>
          <DialogDescription>
            {loc.no.session.datePoll.votes(canAttend.length)}
          </DialogDescription>
        </DialogHeader>
        {groups.map(({ title, users }) => (
          <div key={title} className='flex flex-col'>
            <PageSubheader
              title={title}
              description={users.length.toString()}
            />
            {users.length === 0 ? (
              <Empty className='border border-input text-sm text-muted-foreground'>
                {loc.no.common.noItems}
              </Empty>
            ) : (
              <div className='rounded-sm bg-background-secondary'>
                {users.map(user => (
                  <UserRow
                    key={user.id}
                    item={user}
                    className='min-h-12 w-full py-1'
                    hideRanking
                  />
                ))}
              </div>
            )}
          </div>
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
    editSession(socket, session.id, {
      date: null,
      dateOptions: dates,
      dateVotingClosed: false,
    })
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
