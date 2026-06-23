import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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
            <Outlet />
          </main>
        </div>
      </div>

      <Button
        onClick={() => open()}
        disabled={!isLoggedIn || isLoading}
        className='fixed right-0 bottom-0 z-50 m-12 rounded-full drop-shadow-2xl drop-shadow-black backdrop-blur-2xl disabled:border disabled:bg-background-secondary/90 disabled:text-muted-foreground disabled:opacity-100'
        size='icon-2xl'>
        {isLoading ? <Spinner /> : <PlusIcon className='size-8' />}
      </Button>
    </>
  )
}
