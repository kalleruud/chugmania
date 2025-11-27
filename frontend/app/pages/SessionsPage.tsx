import { SessionsList } from '@/components/session/SessionsList'
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
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'

export default function SessionsPage() {
  const [showPast, setShowPast] = useState(false)

  return (
    <div className='p-safe-or-2 flex flex-col gap-4'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.home}</BreadcrumbLink>
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

      <div className='flex flex-col gap-4'>
        <div>
          <h2 className='text-muted-foreground mb-2 px-1 text-sm font-medium uppercase'>
            {loc.no.session.upcoming}
          </h2>
          <SessionsList filter='upcoming' />
        </div>

        <div>
          <div className='mb-2 flex items-center justify-between px-1'>
            <h2 className='text-muted-foreground text-sm font-medium uppercase'>
              {loc.no.session.past}
            </h2>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setShowPast(!showPast)}>
              {showPast ? 'Skjul' : 'Vis'}
            </Button>
          </div>
          {showPast && <SessionsList filter='past' />}
        </div>
      </div>
    </div>
  )
}
