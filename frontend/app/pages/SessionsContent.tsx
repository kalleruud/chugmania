import {
  getOwnActiveTokens,
  isAtTokenLimit,
} from '@/components/apiToken/apiTokens'
import TokenLimitDialog from '@/components/apiToken/TokenLimitDialog'
import type { Grouping } from '@/components/grouped-list/grouping'
import {
  byMonth,
  byWeek,
  byYear,
} from '@/components/grouped-list/groupings/date'
import { PageHeader } from '@/components/PageHeader'
import SessionsList from '@/components/session/SessionsList'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import { CALENDAR_TOKEN_NAME } from '@common/models/apiToken'
import type { SessionWithSignups } from '@common/models/session'
import {
  getSessionDate,
  isOngoing,
  isPast,
  isUpcoming,
} from '@common/utils/date'
import { CalendarIcon } from '@heroicons/react/24/solid'
import { useState, type ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'

const sessionGroupings = {
  year: byYear(getSessionDate),
  month: byMonth(getSessionDate),
  week: byWeek(getSessionDate),
} satisfies Record<string, Grouping<SessionWithSignups>>

type SessionGroupingKey = keyof typeof sessionGroupings

const ARCHIVE_GROUP_LIMIT = 5
const ARCHIVE_TOTAL_LIMIT = 10
const RECENT_SESSIONS_LIMIT = 1

export function SessionsContent({
  className,
  showLink,
  ...props
}: Readonly<{ showLink?: boolean } & ComponentProps<'div'>>) {
  const { loggedInUser, isLoggedIn } = useAuth()
  const { sessions } = useData()

  const [archiveGrouping, setArchiveGrouping] =
    useState<SessionGroupingKey>('year')

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  const upcomingSessions = sessions?.filter(isUpcoming) ?? []
  const pastSessions = sessions?.filter(isPast) ?? []
  const archivedSessions = pastSessions.toSorted(
    (a, b) => getSessionDate(b).getTime() - getSessionDate(a).getTime()
  )
  const ongoingSessions = sessions?.filter(isOngoing) ?? []

  return (
    <div className={twMerge('flex flex-col gap-2', className)} {...props}>
      <PageHeader
        title={loc.no.session.title}
        description={loc.no.session.description}
        to={showLink ? '/sessions' : undefined}
        Icon={CalendarIcon}
      />

      <SubscribeButton className={twMerge(!canCreate && 'w-full')} />
      {ongoingSessions.length > 0 && (
        <SessionsList
          header={loc.no.session.status.ongoing}
          sessions={ongoingSessions}
          hideCreate
          featured
        />
      )}
      <SessionsList
        header={loc.no.session.status.upcoming}
        sessions={upcomingSessions}
      />
      {!showLink && (
        <SessionsList
          className='rounded-sm border bg-background p-2 pt-4'
          header={loc.no.session.past}
          sessions={archivedSessions}
          grouping={sessionGroupings[archiveGrouping]}
          groupLimit={ARCHIVE_GROUP_LIMIT}
          totalLimit={ARCHIVE_TOTAL_LIMIT}
          hideCreate
          actions={
            <ArchiveGroupingSelect
              value={archiveGrouping}
              onChange={setArchiveGrouping}
            />
          }
        />
      )}
      {showLink && (
        <SessionsList
          className='opacity-75'
          header={loc.no.session.previous}
          sessions={archivedSessions.slice(0, RECENT_SESSIONS_LIMIT)}
          hideCreate
        />
      )}
    </div>
  )
}

function ArchiveGroupingSelect({
  value,
  onChange,
}: Readonly<{
  value: SessionGroupingKey
  onChange: (value: SessionGroupingKey) => void
}>) {
  const options = Object.keys(sessionGroupings) as SessionGroupingKey[]

  return (
    <Select
      value={value}
      onValueChange={next => {
        const option = options.find(key => key === next)
        if (option) onChange(option)
      }}>
      <SelectTrigger size='sm' className='mb-2'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(key => (
          <SelectItem key={key} value={key}>
            {loc.no.common.groupBy[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SubscribeButton({
  className,
  ...rest
}: Readonly<Parameters<typeof Button>[0]>) {
  const { loggedInUser } = useAuth()
  const { apiTokens } = useData()
  const { socket } = useConnection()
  const [isLimitOpen, setIsLimitOpen] = useState(false)

  if (!loggedInUser) return undefined

  const openCalendar = async () => {
    const response = await socket.emitWithAck('get_calendar_url')
    if (!response.success) {
      toast.error(response.message)
      return
    }
    if (response.created) toast.success(loc.no.apiTokens.calendarCreated)
    globalThis.location.assign(
      `${globalThis.location.origin}${response.path}`.replace(
        /^https?:\/\//,
        'webcal://'
      )
    )
  }

  const subscribe = () => {
    const ownActive = getOwnActiveTokens(apiTokens, loggedInUser)
    const hasCalendarToken = ownActive.some(
      token => token.name === CALENDAR_TOKEN_NAME
    )
    if (!hasCalendarToken && isAtTokenLimit(apiTokens, loggedInUser))
      setIsLimitOpen(true)
    else void openCalendar()
  }

  return (
    <>
      <Button
        className={twMerge('flex-1', className)}
        onClick={subscribe}
        {...rest}>
        <CalendarIcon className='size-4' />
        {loc.no.session.calendar.subscribe}
      </Button>
      <TokenLimitDialog
        open={isLimitOpen}
        onOpenChange={setIsLimitOpen}
        tokens={getOwnActiveTokens(apiTokens, loggedInUser)}
        onRevoked={() => void openCalendar()}
      />
    </>
  )
}
