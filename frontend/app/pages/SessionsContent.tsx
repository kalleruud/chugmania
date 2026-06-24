import SessionsList from '@/components/session/SessionsList'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/useAuth'
import { useData } from '@/contexts/useData'
import loc from '@/lib/locales'
import { isOngoing, isPast, isUpcoming } from '@common/utils/date'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageHeader } from '../../components/PageHeader'
import { SubscribeButton } from './SubscribeButton'

export function SessionsContent({
  className,
  showLink,
  ...props
}: Readonly<{ showLink?: boolean } & ComponentProps<'div'>>) {
  const { loggedInUser, isLoggedIn } = useAuth()
  const { sessions } = useData()

  const [showPreviousSessions, setShowPreviousSessions] = useState(false)

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  const upcomingSessions = sessions?.filter(isUpcoming) ?? []
  const pastSessions = sessions?.filter(isPast) ?? []
  const ongoingSessions = sessions?.filter(isOngoing) ?? []

  return (
    <div className={twMerge('flex flex-col gap-2', className)} {...props}>
      <PageHeader
        title={loc.no.session.title}
        description={loc.no.session.description}
        to={showLink ? '/sessions' : undefined}
        icon='CalendarIcon'
      />

      <SubscribeButton className={twMerge(!canCreate && 'w-full')} />

      {ongoingSessions.length > 0 && (
        <SessionsList
          header={loc.no.session.status.ongoing}
          sessions={ongoingSessions}
          hideCreate
        />
      )}

      <SessionsList
        header={loc.no.session.status.upcoming}
        sessions={upcomingSessions}
      />
      {showPreviousSessions && (
        <SessionsList
          className='opacity-75'
          header={loc.no.session.past}
          sessions={pastSessions}
          hideCreate
        />
      )}
      <div>
        <Button
          variant='ghost'
          onClick={() => setShowPreviousSessions(!showPreviousSessions)}>
          {showPreviousSessions ? <ChevronUp /> : <ChevronDown />}
          {loc.no.session.past}
        </Button>
      </div>
    </div>
  )
}
