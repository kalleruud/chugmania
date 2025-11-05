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
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { Plus } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import LapTimeInput from './components/LapTimeInput'

export default function Layout() {
  const { isLoggedIn, isLoading } = useAuth()

  return (
    <>
      <main className='z-0'>
        <Outlet />
      </main>

      <Dialog>
        <form>
          <DialogTrigger asChild>
            <Button
              disabled={!isLoggedIn || isLoading}
              className='disabled:bg-background-secondary/90 drop-shadow-black disabled:text-muted-foreground fixed bottom-0 right-0 z-50 m-12 rounded-full drop-shadow-2xl backdrop-blur-2xl disabled:border disabled:opacity-100'
              size='icon-2xl'>
              {isLoading ? <Spinner /> : <Plus className='size-8' />}
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
            </DialogFooter>
          </DialogContent>
        </form>
      </Dialog>
    </>
  )
}
