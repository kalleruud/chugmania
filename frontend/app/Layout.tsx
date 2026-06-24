import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import LoginCard from '@/components/user/LoginCard'
import { useAuth } from '@/contexts/AuthContext'
import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  const { isLoggedIn, isLoading } = useAuth()
  const { open } = useTimeEntryInput()

  return (
    <>
      <div className='flex flex-col items-center-safe py-safe-or-4 px-safe-or-2'>
        <div className='w-full max-w-2xl'>
          <main className='z-0 pb-28'>
            {isLoading ? (
              <div className='flex min-h-96 items-center justify-center'>
                <Spinner />
              </div>
            ) : isLoggedIn ? (
              <Outlet />
            ) : (
              <LoginCard />
            )}
          </main>
        </div>
      </div>

      {isLoggedIn && (
        <Button
          onClick={() => open()}
          className='fixed right-0 bottom-0 z-50 m-12 rounded-full drop-shadow-2xl drop-shadow-black backdrop-blur-2xl'
          size='icon-2xl'>
          <PlusIcon className='size-8' />
        </Button>
      )}
    </>
  )
}
