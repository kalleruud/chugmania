import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useEffect, type ReactNode } from 'react'

export default function Ready({ children }: Readonly<{ children: ReactNode }>) {
  const { isLoadingData } = useData()
  const { isLoading } = useAuth()
  const ready = !isLoadingData && !isLoading

  useEffect(() => {
    if (!ready) return
    requestAnimationFrame(() =>
      document.fonts.ready.then(() => {
        const mockup = document.getElementById('mockup')
        const height = mockup?.getBoundingClientRect().height ?? 0
        document.body.dataset.height = String(Math.ceil(height))
      })
    )
  }, [ready])

  if (!ready) return null
  if (window.mockup?.bare)
    return (
      <div id='mockup' className='flow-root'>
        {children}
      </div>
    )
  return (
    <div id='mockup' className='flow-root'>
      <div className='flex flex-col items-center-safe py-safe-or-4 px-safe-or-2'>
        <div className='w-full max-w-2xl'>{children}</div>
      </div>
    </div>
  )
}
