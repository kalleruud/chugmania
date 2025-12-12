import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { SessionWithSignups } from '@common/models/session'
import { PlusIcon } from '@heroicons/react/24/solid'
import { useState, type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageSubheader } from '../PageHeader'
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
import SessionForm from './SessionForm'
import { SessionRow } from './SessionRow'

type SessionsListProps = {
  className?: string
  header: string
  collapsed?: boolean
  sessions: SessionWithSignups[]
  hideCreate?: boolean
}

export default function SessionsList({
  className,
  header,
  sessions,
  hideCreate,
  ...rest
}: Readonly<SessionsListProps & ComponentProps<'div'>>) {
  const { sessions: sd } = useData()
  const { isLoading, isLoggedIn, loggedInUser } = useAuth()
  const [open, setOpen] = useState(false)

  const isModerator = isLoggedIn && loggedInUser.role !== 'user'

  if (sd === undefined) {
    return (
      <div className={twMerge('flex flex-col gap-2', className)} {...rest}>
        <h3 className='text-muted-foreground text-sm font-medium uppercase'>
          {header}
        </h3>
        <Skeleton className='divide-border h-16 w-full divide-y rounded-sm' />
      </div>
    )
  }

  return (
    <div className={twMerge('flex flex-col', className)} {...rest}>
      <PageSubheader title={header} />
      {sessions.length > 0 ? (
        <div className={twMerge('bg-background-secondary rounded-sm')}>
          {sessions.map(session => (
            <SessionRow
              key={session.id}
              item={session}
              className='py-3 first:pt-4 last:pb-4'
            />
          ))}
        </div>
      ) : (
        <Empty className='border-input text-muted-foreground border text-sm'>
          {loc.no.common.noItems}
        </Empty>
      )}

      {!hideCreate && isModerator && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground mt-2 w-fit'>
              <PlusIcon />
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
