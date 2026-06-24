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
import { useState } from 'react'
import { Spinner } from '../ui/spinner'
import UserForm from './UserForm'

const ALLOW_SIGNUPS = false

export default function LoginCard() {
  const { isLoggedIn, isLoading } = useAuth()
  const [openLogin, setOpenLogin] = useState(false)
  const [openRegister, setOpenRegister] = useState(false)

  if (isLoggedIn) return undefined

  if (isLoading) {
    return (
      <Empty className='w-full rounded-sm border border-dashed'>
        <Spinner />
      </Empty>
    )
  }

  return (
    <Empty className='w-full rounded-sm border border-dashed'>
      <EmptyHeader>
        <EmptyTitle>{loc.no.user.notLoggedIn}</EmptyTitle>
        <EmptyDescription>{loc.no.user.login.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className='flex gap-2'>
          {ALLOW_SIGNUPS && (
            <Dialog open={openRegister} onOpenChange={setOpenRegister}>
              <DialogTrigger asChild>
                <Button variant='outline' size='sm'>
                  {loc.no.user.register.title}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{loc.no.user.register.title}</DialogTitle>
                  <DialogDescription>
                    {loc.no.user.register.description}
                  </DialogDescription>
                </DialogHeader>

                <UserForm
                  id='registerForm'
                  variant='create'
                  className='py-2'
                  onSubmitResponse={success =>
                    success && setOpenRegister(false)
                  }
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
                    form='registerForm'
                    disabled={isLoading}>
                    {isLoading && <Spinner />}
                    {isLoading
                      ? loc.no.user.register.request.loading
                      : loc.no.user.register.title}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={openLogin} onOpenChange={setOpenLogin}>
            <DialogTrigger asChild>
              <Button size='sm'>{loc.no.user.login.title}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{loc.no.user.login.title}</DialogTitle>
                <DialogDescription>
                  {loc.no.user.login.description}
                </DialogDescription>
              </DialogHeader>

              <UserForm
                id='loginForm'
                variant='login'
                className='py-2'
                onSubmitResponse={success => success && setOpenLogin(false)}
                disabled={isLoading}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant='outline' disabled={isLoading}>
                    {loc.no.common.cancel}
                  </Button>
                </DialogClose>
                <Button type='submit' form='loginForm' disabled={isLoading}>
                  {isLoading && <Spinner />}
                  {isLoading
                    ? loc.no.user.login.request.loading
                    : loc.no.user.login.title}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </EmptyContent>
    </Empty>
  )
}
