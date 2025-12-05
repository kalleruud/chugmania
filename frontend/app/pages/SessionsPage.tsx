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
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { CalendarIcon } from '@heroicons/react/24/solid'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageHeader } from '../../components/PageHeader'
import { isPast, isUpcoming } from '../utils/date'

export default function SessionsPage() {
  const { loggedInUser, isLoggedIn } = useAuth()
  const { sessions } = useData()

  const [showPreviousSessions, setShowPreviousSessions] = useState(false)

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  const upcomingSessions = sessions?.filter(s => isUpcoming(s)) ?? []
  const pastSessions = sessions?.filter(s => isPast(s)) ?? []

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

      <PageHeader
        title={loc.no.session.title}
        description={loc.no.session.description}
        icon='CalendarIcon'
      />

      <SubscribeButton className={twMerge(!canCreate && 'w-full')} />

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

export function SubscribeButton({
  className,
  variant,
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
