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
import loc from '@/lib/locales'
import { CalendarIcon } from '@heroicons/react/24/solid'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageHeader } from '../../components/PageHeader'

export default function SessionsPage() {
  const [showPreviousSessions, setShowPreviousSessions] = useState(false)
  const { loggedInUser, isLoggedIn } = useAuth()

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

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

      <SessionsList header={loc.no.session.upcoming} upcoming />
      {showPreviousSessions && (
        <SessionsList header={loc.no.session.past} past />
      )}
      <div>
        <Button
          variant='ghost'
          onClick={() => setShowPreviousSessions(!showPreviousSessions)}>
          {loc.no.session.past}
          {showPreviousSessions ? <ChevronUp /> : <ChevronDown />}
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
