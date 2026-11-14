import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { SessionWithSignups } from '@common/models/session'
import { Plus } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageSubheader } from '../PageHeader'
import GroupedList from '../grouped-list/GroupedList'
import type { Grouping } from '../grouped-list/grouping'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import SessionCard from './SessionCard'
import SessionForm from './SessionForm'
import { SessionRow } from './SessionRow'

type SessionsListProps = {
  className?: string
  header: string
  collapsed?: boolean
  sessions: SessionWithSignups[]
  hideCreate?: boolean
  featured?: boolean
  grouping?: Grouping<SessionWithSignups>
  pageSize?: number
  actions?: ReactNode
}

export default function SessionsList({
  className,
  header,
  sessions,
  hideCreate,
  featured,
  grouping,
  pageSize,
  actions,
  ...rest
}: Readonly<SessionsListProps & ComponentProps<'div'>>) {
  const { sessions: sd } = useData()
  const { isLoading, isLoggedIn, loggedInUser } = useAuth()
  const [open, setOpen] = useState(false)

  const isModerator = isLoggedIn && loggedInUser.role !== 'user'

  const SessionComponent = featured ? SessionCard : SessionRow

  if (sd === undefined) {
    return (
      <div className={twMerge('flex flex-col gap-2', className)} {...rest}>
        <h3 className='text-sm font-medium text-muted-foreground uppercase'>
          {header}
        </h3>
        <Skeleton className='h-16 w-full divide-y divide-border rounded-sm' />
      </div>
    )
  }

  return (
    <div className={twMerge('flex flex-col', className)} {...rest}>
      <PageSubheader title={header} description={sessions.length.toString()} />
      {actions}
      <GroupedList
        items={sessions}
        Row={SessionComponent}
        getKey={session => session.id}
        grouping={grouping}
        pageSize={pageSize}
        rowProps={() => ({
          className: 'rounded-sm bg-background-secondary p-4',
        })}
      />

      {!hideCreate && isModerator && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='mt-2 w-fit text-muted-foreground'>
              <Plus />
              {loc.no.session.create.title}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{loc.no.session.create.title}</DialogTitle>
              <DialogDescription>
                {loc.no.session.create.description}
              </DialogDescription>
            </DialogHeader>

            <SessionForm
              id='createSessionForm'
              variant='create'
              className='py-2'
              onSubmitResponse={() => setOpen(false)}
              disabled={isLoading}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline' disabled={isLoading}>
                  {loc.no.common.cancel}
                </Button>
              </DialogClose>
              <Button
                type='submit'
                form='createSessionForm'
                disabled={isLoading}>
                {loc.no.common.continue}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
