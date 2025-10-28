import {
  CalendarDays,
  Home,
  Map,
  Plus,
  Shield,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './components/Button'
import LapTimeInput from './components/LapTimeInput'

type MobileNavItem = {
  label: string
  icon?: LucideIcon
  to?: string
  action?: () => void
  hide?: boolean
}

export default function Layout() {
  const { isLoggedIn, user, requiresEmailUpdate } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showTimeInput, setShowTimeInput] = useState(false)

  const containerRef = useRef<HTMLTableRowElement | null>(null)
  const [width, setWidth] = useState(0)

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

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (typeof w === 'number') setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const title = useMemo(() => {
    return width >= 800 ? 'Chugmania' : 'CM'
  }, [width])

  return (
    <>
      <header className='sticky left-0 top-0 z-50 hidden w-full justify-center px-4 pt-4 sm:flex'>
        <div className='border-stroke flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 rounded-3xl border bg-black/30 p-4 backdrop-blur-xl'>
          <NavLink
            to='/'
            className='flex items-baseline text-white no-underline'>
            <span className='font-f1-black text-accent text-4xl uppercase'>
              {title}
            </span>
          </NavLink>

          <nav className='font-f1 mr-auto flex text-sm'>
            {mobileNavButtons
              .filter(button => button.hide !== true)
              .map(button =>
                button.to ? (
                  <NavLink
                    key={button.label}
                    to={button.to}
                    className={({ isActive }) =>
                      isActive
                        ? 'relative rounded-md px-3 py-1.5 text-white no-underline transition'
                        : 'text-label-muted relative rounded-md px-3 py-1.5 no-underline transition hover:text-white'
                    }>
                    <h5>{button.label}</h5>
                  </NavLink>
                ) : (
                  <Button key={button.label} onClick={button.action} size='sm'>
                    {button.label}
                  </Button>
                )
              )}
          </nav>

          {isLoggedIn && (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => setShowTimeInput(true)}
              className='rounded-lg px-3 py-1.5 text-xs shadow-sm'>
              <Plus size={14} />
              Register laptime
            </Button>
          )}
        </div>
      </header>

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

      <nav className='border-t-stroke pb-safe-or-4 fixed bottom-0 left-0 right-0 z-50 border-t bg-black/70 pt-4 backdrop-blur-xl sm:hidden'>
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
