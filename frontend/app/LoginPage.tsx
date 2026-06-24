import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Spinner } from '@/components/ui/spinner'
import UserForm from '@/components/user/UserForm'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { useState } from 'react'

export default function LoginPage() {
  const { isLoading } = useAuth()
  const [openRegister, setOpenRegister] = useState(false)

  const allowSignups = import.meta.env.VITE_ALLOW_SIGNUPS === 'true'

  return (
    <main className='min-h-dvh-safe bg-background text-foreground'>
      <div className='flex min-h-dvh-safe flex-col items-center justify-center gap-4 py-safe-or-6 px-safe-or-4'>
        <h1 className='text-primary'>{loc.no.chugmania}</h1>

        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle>{loc.no.user.login.title}</CardTitle>
            <CardDescription>{loc.no.user.login.description}</CardDescription>
          </CardHeader>

          <CardContent>
            <UserForm id='loginForm' variant='login' disabled={isLoading} />
          </CardContent>

          <CardFooter className='justify-end gap-2'>
            <Dialog open={openRegister} onOpenChange={setOpenRegister}>
              <DialogTrigger asChild>
                <Button
                  variant='outline'
                  title={loc.no.user.register.notEnabled}
                  disabled={!allowSignups}>
                  {loc.no.user.register.description}
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

            <Button type='submit' form='loginForm' disabled={isLoading}>
              {isLoading && <Spinner />}
              {isLoading
                ? loc.no.user.login.request.loading
                : loc.no.user.login.title}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
