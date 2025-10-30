import {
  CalendarDays,
  Home,
  Map,
  Shield,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../components/Button'
import LapTimeInput from '../components/LapTimeInput'

type MobileNavItem = {
  label: string
  icon?: LucideIcon
  to?: string
  action?: () => void
  hide?: boolean
}

export default function MobileLayout() {
  const { isLoggedIn, user, requiresEmailUpdate } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showTimeInput, setShowTimeInput] = useState(false)

  const mobileNavButtons: MobileNavItem[] = [
    { label: 'Home', icon: Home, to: '/' },
    { label: 'Tracks', icon: Map, to: '/tracks' },
    { label: 'Sessions', icon: CalendarDays, to: '/sessions' },
    {
      label: 'Add time',
      icon: Timer,
      action: () => setShowTimeInput(true),
      hide: !isLoggedIn,
    },
    {
      label: 'Players',
      icon: Users,
      to: '/players',
    },
    {
      label: 'Admin',
      icon: Shield,
      to: '/admin',
      hide: user?.role !== 'admin',
    },
  ]

  useEffect(() => {
    if (showTimeInput) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [showTimeInput])

  useEffect(() => {
    if (!user || !requiresEmailUpdate) return
    const target = `/players/${user.id}`
    if (location.pathname !== target) navigate(target, { replace: true })
  }, [user, requiresEmailUpdate, location.pathname, navigate])

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

      <main className='z-0 pb-20'>
        <Outlet />
      </main>

      <nav className='border-t-stroke pb-safe-or-4 fixed bottom-0 left-0 right-0 z-50 border-t bg-black/70 pt-4 backdrop-blur-xl'>
        <div className='font-f1 flex items-center px-2'>
          {mobileNavButtons
            .filter(i => i.hide !== true)
            .map(item => {
              const Icon = item.icon

              if (item.to)
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex w-full items-center justify-center transition hover:text-white ${
                        isActive ? 'text-white' : 'text-label-muted'
                      }`
                    }>
                    {Icon && <Icon className='size-6' />}
                    <span className='sr-only'>{item.label}</span>
                  </NavLink>
                )

              return (
                <Button
                  key={item.label}
                  type='button'
                  onClick={item.action}
                  className='w-full items-center justify-center transition'>
                  {Icon && <Icon className='size-6' />}
                  <span className='sr-only'>{item.label}</span>
                </Button>
              )
            })}
        </div>
      </nav>

      <div className='main-background fixed inset-0 top-0 -z-10 h-screen' />
    </>
  )
}
