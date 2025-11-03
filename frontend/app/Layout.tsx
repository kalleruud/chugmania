import { Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Button } from './components/Button'
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
              variant='tertiary'
              size='md'
              className='text-label-muted mt-3 w-full normal-case'
              onClick={() => setShowTimeInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <main className='z-0' ref={containerRef}>
        <Outlet />
      </main>

      <nav>
        <Button
          className='fixed bottom-0 right-0 z-50 m-12 rounded-full pb-4 pt-4 backdrop-blur-xl sm:hidden'
          onClick={() => setShowTimeInput(true)}>
          <Timer />
        </Button>
      </nav>
    </>
  )
}
