import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useTimeEntryDrawer } from '@/hooks/TimeEntryDrawerProvider'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  const { isLoggedIn, isLoading } = useAuth()
  const { open } = useTimeEntryDrawer()

  return (
    <>
      <div className='items-center-safe px-safe-or-2 py-safe-or-4 flex flex-col'>
        <div className='w-full max-w-2xl'>
          <main className='z-0 pb-28'>
            <Outlet />
          </main>
        </div>
      </div>

      <Button
        onClick={() => open()}
        disabled={!isLoggedIn || isLoading}
        className='disabled:bg-background-secondary/90 drop-shadow-black disabled:text-muted-foreground fixed bottom-0 right-0 z-50 m-12 rounded-full drop-shadow-2xl backdrop-blur-2xl disabled:border disabled:opacity-100'
        size='icon-2xl'>
        {isLoading ? <Spinner /> : <PlusIcon className='size-8' />}
      </Button>
    </>
  )
}
