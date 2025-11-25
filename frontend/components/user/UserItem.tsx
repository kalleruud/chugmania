import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { ChevronRight } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import { type UserInfo } from '../../../common/models/user'
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

function UserRow({
  user,
  className,
  variant,
  ...props
}: Readonly<UserItemProps>) {
  return (
    <Item key={user.id} className={className} asChild {...props}>
      <Link to={`/users/${user.id}`}>
        <ItemContent>
          <div className='flex items-center gap-2'>
            <div className='bg-primary h-4 w-1 rounded-full' />
            <ItemTitle className='font-f1 mr-auto flex gap-1 uppercase'>
              <span>{user.firstName}</span>
              <span className='font-bold'>{user.lastName}</span>
            </ItemTitle>

            <span className='text-f1 text-muted-foreground font-bold'>
              {user.shortName}
            </span>
          </div>
        </ItemContent>
        <ItemActions>
          <ChevronRight className='size-4' />
        </ItemActions>
      </Link>
    </Item>
  )
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
                {loc.no.dialog.continue}
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
