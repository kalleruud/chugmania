import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import { type UserInfo } from '@common/models/user'
import { formatYear } from '@common/utils/date'
import { PencilIcon } from '@heroicons/react/24/solid'
import { Trash2 } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import ConfirmationButton from '../ConfirmationButton'
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

type UserCardProps = {
  user: UserInfo
} & ComponentProps<'div'>

export default function UserCard({
  user,
  className,
  ...props
}: Readonly<UserCardProps>) {
  const { logout, isLoading, loggedInUser } = useAuth()
  const { socket } = useConnection()
  const [open, setOpen] = useState(false)

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
          <span className='text-sm'>{`${loc.no.user.joined} ${formatYear(user.createdAt)}`}</span>
        </div>
      </div>

      {canEdit && (
        <div className='flex justify-center gap-2'>
          <ConfirmationButton
            variant='destructive'
            size='sm'
            disabled={isSelf || isLoading}
            onClick={handleDeleteUser}>
            <Trash2 className='mr-2 size-4' />
            {loc.no.common.delete}
          </ConfirmationButton>

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
                      {loc.no.common.cancel}
                    </Button>
                  </DialogClose>
                  <ConfirmationButton form='editForm' disabled={isLoading}>
                    {loc.no.common.continue}
                  </ConfirmationButton>
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
