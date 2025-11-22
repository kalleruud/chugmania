import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { DialogClose, DialogTrigger } from '@radix-ui/react-dialog'
import { Spinner } from '../ui/spinner'
import UserForm from './UserForm'

export default function LoginCard() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoggedIn) return undefined

  if (isLoading) {
    return (
      <Empty className='w-full border border-dashed'>
        <Spinner />
      </Empty>
    )
  }

  return (
    <Empty className='w-full border border-dashed'>
      <EmptyHeader>
        <EmptyTitle>{loc.no.login.notLoggedIn}</EmptyTitle>
        <EmptyDescription>{loc.no.login.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Dialog>
          <DialogTrigger asChild>
            <Button size='sm'>{loc.no.login.title}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{loc.no.login.title}</DialogTitle>
              <DialogDescription>{loc.no.login.description}</DialogDescription>
            </DialogHeader>

            <UserForm
              id='loginForm'
              variant='login'
              className='py-2'
              disabled={isLoading}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline' disabled={isLoading}>
                  {loc.no.dialog.cancel}
                </Button>
              </DialogClose>
              <Button type='submit' form='loginForm' disabled={isLoading}>
                {isLoading && <Spinner />}
                {isLoading ? loc.no.login.request.loading : loc.no.login.title}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </EmptyContent>
    </Empty>
  )
}
