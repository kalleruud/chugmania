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
import { Outlet } from 'react-router-dom'
import LapTimeInput from './components/LapTimeInput'

export default function Layout() {
  return (
    <>
      <main className='z-0'>
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
              {/* <Button type='submit'>Yeet</Button> */}
            </DialogFooter>
          </DialogContent>
        </form>
      </Dialog>
    </>
  )
}
