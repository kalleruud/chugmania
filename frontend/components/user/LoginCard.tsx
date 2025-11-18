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
import type { FormEvent } from 'react'
import { Spinner } from '../ui/spinner'
import UserForm from './UserForm'

export default function LoginCard() {
  const { isLoggedIn, isLoading, login } = useAuth()

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    console.log('Logging in')
  }

  if (isLoggedIn) return undefined

  if (isLoading)
    return (
      <Empty className='w-full border border-dashed'>
        <Spinner />
      </Empty>
    )

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
          <form id='loginForm' onSubmit={handleSubmit}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{loc.no.login.title}</DialogTitle>
                <DialogDescription>
                  {loc.no.login.description}
                </DialogDescription>
              </DialogHeader>

              <UserForm variant='login' className='py-2' />

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant='outline'>{loc.no.cancel}</Button>
                </DialogClose>
                <Button type='submit' form='loginForm'>
                  {loc.no.login.title}
                </Button>
              </DialogFooter>
            </DialogContent>
          </form>
        </Dialog>
      </EmptyContent>
    </Empty>
  )
}
