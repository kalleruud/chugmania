import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import { PencilIcon } from '@heroicons/react/24/solid'
import { ChevronRight, Trash2 } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
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
  const { logout, isLoading, loggedInUser } = useAuth()
  const { socket } = useConnection()
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const isSelf = loggedInUser?.id === user.id
  const isAdmin = loggedInUser?.role === 'admin'
  const canEdit = isSelf || isAdmin

  const handleDeleteUser = async () => {
    toast.promise(
      socket
        .emitWithAck('delete_user', {
          type: 'DeleteUserRequest',
          id: user.id,
        })
        .then(r => {
          setDeleteDialogOpen(false)
          if (!r.success) throw new Error(r.message)
          return r
        }),
      {
        loading: 'Sletter bruker...',
        success: 'Brukeren ble slettet',
        error: (err: Error) => `Sletting feilet: ${err.message}`,
      }
    )
  }

  return (
    <div className={twMerge('flex flex-col gap-4', className)} {...props}>
      <div className='flex flex-col items-center justify-center gap-2'>
        <div className='flex flex-col items-center'>
          <h1 className='font-northwell text-primary z-1 -mb-6 pt-4 text-6xl normal-case'>
            {user.firstName}
          </h1>
          <h1 className='font-f1 uppercase'>{user.lastName}</h1>
        </div>

        <div className='text-muted-foreground flex gap-2'>
          <span className='text-sm'>{user.shortName ?? '-'}</span>
          <span className='border-r' />
          <span className='text-sm'>{loc.no.user.role[user.role]}</span>
          <span className='border-r' />
          <span className='text-sm'>{`${loc.no.user.joined} ${user.createdAt.getFullYear()}`}</span>
        </div>
      </div>

      {canEdit && (
        <div className='flex justify-center gap-2'>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant='destructive' size='sm' disabled={isSelf}>
                <Trash2 className='mr-2 size-4' />
                {loc.no.common.delete}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{loc.no.dialog.confirmDelete.title}</DialogTitle>
                <DialogDescription>
                  {loc.no.dialog.confirmDelete.description}
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant='outline'>{loc.no.dialog.cancel}</Button>
                </DialogClose>
                <Button
                  variant='destructive'
                  onClick={handleDeleteUser}
                  disabled={isLoading}>
                  {loc.no.common.delete}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant='outline' size='sm'>
                  <PencilIcon />
                  {loc.no.common.edit}
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
                  onSubmitResponse={() => setOpen(false)}
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
          )}

          {isSelf && (
            <Button onClick={logout} variant='destructive' size='sm'>
              {loc.no.user.logout.title}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
