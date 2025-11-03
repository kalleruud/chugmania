import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { AlertDialog } from '@radix-ui/react-alert-dialog'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import LapTimeInput from './components/LapTimeInput'

export default function Layout() {
  const [showTimeInput, setShowTimeInput] = useState(false)

  const containerRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (showTimeInput) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [showTimeInput])

  return (
    <>
      {showTimeInput && (
        <div className='z-100 backdrop-blur-xs fixed inset-0 left-0 top-0 flex h-dvh w-full items-center justify-center bg-black/50'>
          <div className='bg-background-secondary rounded-2xl border border-white/10 p-8 shadow-2xl'>
            <LapTimeInput onSubmit={() => setShowTimeInput(false)} />
            <Button
              type='button'
              className='mt-3 w-full normal-case'
              onClick={() => setShowTimeInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <main className='z-0' ref={containerRef}>
        <Outlet />
      </main>

      <nav className='fixed bottom-0 right-0 m-12'>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className='z-50 rounded-full' size='icon-2xl'>
              <Plus className='size-6' />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <h2>Registrer tid</h2>
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                account and remove your data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <LapTimeInput />

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </nav>
    </>
  )
}
