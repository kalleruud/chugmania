import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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

      <Dialog>
        <form>
          <DialogTrigger asChild>
            <Button
              className='fixed bottom-0 right-0 z-50 m-12 rounded-full'
              size='icon-2xl'>
              <Plus className='size-6' />
            </Button>
          </DialogTrigger>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>
                <h2>Registrer tid</h2>
              </DialogTitle>
            </DialogHeader>

            <LapTimeInput />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline'>Nah</Button>
              </DialogClose>
              <Button type='submit'>Yeet</Button>
            </DialogFooter>
          </DialogContent>
        </form>
      </Dialog>

      {/* <nav className='fixed bottom-0 right-0 m-12'>
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
      </nav> */}
    </>
  )
}
