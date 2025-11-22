import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import type { UserInfo } from '../../../common/models/user'
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
import { Spinner } from '../ui/spinner'
import UserForm from './UserForm'

type UserItemProps = {
  user: UserInfo
  variant?: 'row' | 'card'
} & ComponentProps<'div'>

export default function UserItem(props: Readonly<UserItemProps>) {
  switch (props.variant) {
    case 'row':
      return <UserRow {...props} />
    case 'card':
      return <UserCard {...props} />
  }
}

function UserRow({ user, ...props }: Readonly<UserItemProps>) {
  return <div {...props}>{user.lastName}</div>
}

function UserCard({ user, className, ...props }: Readonly<UserItemProps>) {
  const { logout, isLoading } = useAuth()

  return (
    <div
      className={twMerge(
        'flex flex-col items-center justify-between gap-4',
        className
      )}
      {...props}>
      <div className='flex items-center justify-center gap-2'>
        <h2 className='font-northwell pt-4 text-4xl'>{user.firstName}</h2>
        <h2 className='font-f1 uppercase'>{user.lastName}</h2>
      </div>
      <div className='flex gap-2'>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant='outline' size='sm'>
              {loc.no.user.edit.title}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{loc.no.user.edit.title}</DialogTitle>
              <DialogDescription>
                {loc.no.user.edit.description}
              </DialogDescription>
            </DialogHeader>

            <UserForm
              id='editForm'
              variant='edit'
              user={user}
              className='py-2'
              disabled={isLoading}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline' disabled={isLoading}>
                  {loc.no.dialog.cancel}
                </Button>
              </DialogClose>
              <Button type='submit' form='editForm' disabled={isLoading}>
                {isLoading && <Spinner />}
                {isLoading
                  ? loc.no.user.edit.request.loading
                  : loc.no.user.edit.title}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button onClick={logout} size='sm'>
          {loc.no.user.logout.title}
        </Button>
      </div>
    </div>
  )
}
