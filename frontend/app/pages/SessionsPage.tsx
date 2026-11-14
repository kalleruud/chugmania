import {
  sessionGroupings,
  type SessionGroupingKey,
} from '@/components/session/session.groupings'
import SessionsList from '@/components/session/SessionsList'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import { isOngoing, isPast, isUpcoming } from '@common/utils/date'
import { CalendarIcon } from '@heroicons/react/24/solid'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageHeader } from '../../components/PageHeader'

const ARCHIVE_PAGE_SIZE = 5

export default function SessionsPage() {
  return (
    <div className='flex flex-col gap-2'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.session.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <SessionsContent />
    </div>
  )
}

export function SessionsContent({
  className,
  showLink,
  ...props
}: Readonly<{ showLink?: boolean } & ComponentProps<'div'>>) {
  const { loggedInUser, isLoggedIn } = useAuth()
  const { sessions } = useData()

  const [showPreviousSessions, setShowPreviousSessions] = useState(false)
  const [archiveGrouping, setArchiveGrouping] =
    useState<SessionGroupingKey>('year')

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  const upcomingSessions = sessions?.filter(isUpcoming) ?? []
  const pastSessions = sessions?.filter(isPast) ?? []
  const archivedSessions = pastSessions.toSorted(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
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
          header={loc.no.session.past}
          sessions={archivedSessions}
          grouping={sessionGroupings[archiveGrouping]}
          pageSize={ARCHIVE_PAGE_SIZE}
          hideCreate
          actions={
            <ArchiveGroupingToggle
              value={archiveGrouping}
              onChange={setArchiveGrouping}
            />
          }
        />
      )}
      {showLink && showPreviousSessions && (
        <SessionsList
          className='opacity-75'
          header={loc.no.session.past}
          sessions={pastSessions}
          hideCreate
        />
      )}
      {showLink && (
        <div>
          <Button
            variant='ghost'
            onClick={() => setShowPreviousSessions(!showPreviousSessions)}>
            {showPreviousSessions ? <ChevronUp /> : <ChevronDown />}
            {loc.no.session.past}
          </Button>
        </div>
      )}
    </div>
  )
}

function ArchiveGroupingToggle({
  value,
  onChange,
}: Readonly<{
  value: SessionGroupingKey
  onChange: (value: SessionGroupingKey) => void
}>) {
  const options = Object.keys(sessionGroupings) as SessionGroupingKey[]

  return (
    <ToggleGroup
      type='single'
      value={value}
      onValueChange={next => {
        const option = options.find(key => key === next)
        if (option) onChange(option)
      }}
      variant='outline'
      size='sm'
      className='mb-2'>
      {options.map(key => (
        <ToggleGroupItem key={key} value={key}>
          {loc.no.common.groupBy[key]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function SubscribeButton({
  className,
  ...rest
}: Readonly<Parameters<typeof Button>[0]>) {
  const subscribe = () => {
    const url =
      `${globalThis.location.origin}/api/sessions/calendar.ics`.replace(
        /^https?:\/\//,
        'webcal://'
      )
    window.open(url)
  }

  return (
    <Button
      className={twMerge('flex-1', className)}
      onClick={subscribe}
      {...rest}>
      <CalendarIcon className='size-4' />
      {loc.no.session.calendar.subscribe}
    </Button>
  )
}
