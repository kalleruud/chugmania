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
import loc from '@/lib/locales'
import { CalendarIcon } from '@heroicons/react/24/solid'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageHeader } from '../../components/PageHeader'

export default function SessionsPage() {
  const [showPreviousSessions, setShowPreviousSessions] = useState(false)

  return (
    <div className='p-safe-or-2 flex flex-col gap-2'>
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

      <SubscribeButton />

      <SessionsList header={loc.no.session.upcoming} after={new Date()} />
      {showPreviousSessions ? (
        <SessionsList header={loc.no.session.past} before={new Date()} />
      ) : (
        <div>
          <Button variant='ghost' onClick={() => setShowPreviousSessions(true)}>
            {loc.no.session.past}
            <ChevronDown />
          </Button>
        </div>
      )}
    </div>
  )
}

export function SubscribeButton({
  className,
  variant,
  ...rest
}: Parameters<typeof Button>[0]) {
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
      variant={variant ?? 'outline'}
      className={twMerge('w-full', className)}
      onClick={subscribe}
      {...rest}>
      <CalendarIcon />
      {loc.no.session.calendar.subscribe}
    </Button>
  )
}
