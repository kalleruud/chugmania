import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useTimeEntryInput } from '@/contexts/TimeEntryInputContext'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Outlet } from 'react-router'
import LoginPage from './pages/LoginPage'

export default function Layout() {
  const { isLoggedIn, isLoading } = useAuth()
  const { open } = useTimeEntryInput()

  if (isLoading) {
    return (
      <main className='flex min-h-dvh-safe items-center justify-center'>
        <Spinner />
      </main>
    )
  }

  if (!isLoggedIn) return <LoginPage />

  return (
    <>
      <div className='flex flex-col items-center-safe py-safe-or-4 px-safe-or-2'>
        <div className='w-full max-w-2xl'>
          <main className='z-0 pb-28'>
            <Outlet />
          </main>
        </div>
      </div>

      <Button
        onClick={() => open()}
        className='fixed right-0 bottom-0 z-50 m-12 rounded-full drop-shadow-2xl drop-shadow-black backdrop-blur-2xl'
        size='icon-2xl'>
        <PlusIcon className='size-8' />
      </Button>
    </>
  )
}
