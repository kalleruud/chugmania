import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
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
import { Item, ItemContent, ItemMedia } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import UserForm from '@/components/user/UserForm'
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { PlusIcon } from '@heroicons/react/24/solid'
import { useState, type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import type { UserInfo } from '../../../common/models/user'
import { PageHeader } from '../../components/PageHeader'

type UsersPageProps = {
  showAll?: boolean
} & ComponentProps<'div'>

function UserRowList({ users }: Readonly<{ users: UserInfo[] }>) {
  if (users.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {loc.no.common.noItems}
      </Empty>
    )
  }
  return (
    <div className='bg-background-secondary rounded-sm'>
      {users.map(user => (
        <UserItem
          key={user.id}
          user={user}
          variant='row'
          className='py-3 first:pt-4 last:pb-4'
        />
      ))}
    </div>
  )
}

export default function UsersPage(props: Readonly<UsersPageProps>) {
  return (
    <div>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.users.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <UsersList {...props} showAll />
    </div>
  )
}

export function UsersList({ className, showAll }: Readonly<UsersPageProps>) {
  const { users: ud } = useData()
  const { isLoggedIn, loggedInUser, isLoading } = useAuth()
  const isModerator = isLoggedIn && loggedInUser.role !== 'user'

  const [open, setOpen] = useState(false)

  if (ud === undefined) {
    return (
      <div className={twMerge('flex flex-col', className)}>
        <Item>
          <ItemMedia>
            <Skeleton className='size-8 rounded-sm' />
          </ItemMedia>
          <ItemContent>
            <Skeleton className='h-6 w-24 rounded-sm' />
            <Skeleton className='h-4 w-64 rounded-sm' />
          </ItemContent>
        </Item>

        <div className='overflow-clip rounded-sm'>
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
        </div>
      </div>
    )
  }

  const users = Object.values(ud).filter(
    u => !u.email.endsWith('@chugmania.no') || showAll
  )

  return (
    <div className={twMerge('flex flex-col', className)}>
      <PageHeader
        title={loc.no.users.title}
        description={loc.no.users.description}
        icon={'UsersIcon'}
      />

      <UserRowList users={users} />

      {isModerator && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground mt-2 w-fit'>
              <PlusIcon />
              {loc.no.user.create.title}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{loc.no.user.create.title}</DialogTitle>
              <DialogDescription>
                {loc.no.user.create.description}
              </DialogDescription>
            </DialogHeader>

            <UserForm
              id='createUserForm'
              variant='create'
              className='py-2'
              onSubmitResponse={() => setOpen(false)}
              disabled={isLoading}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline' disabled={isLoading}>
                  {loc.no.dialog.cancel}
                </Button>
              </DialogClose>
              <Button type='submit' form='createUserForm' disabled={isLoading}>
                {loc.no.dialog.continue}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
