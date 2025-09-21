import { LogIn, LogOut, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LapTimeInput from './components/LapTimeInput'

export default function Layout() {
  const { isLoggedIn, logout } = useAuth()
  const [showTimeInput, setShowTimeInput] = useState(false)

  const containerRef = useRef<HTMLTableRowElement | null>(null)
  const [width, setWidth] = useState(0)

  const navButtons = [
    { to: '/tracks', label: 'Tracks' },
    { to: '/players', label: 'Players' },
  ]

  useEffect(() => {
    if (showTimeInput) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [showTimeInput])

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
            className='flex items-baseline text-white no-underline'
          >
            <span className='font-f1-black text-accent text-4xl uppercase'>
              {title}
            </span>
          </NavLink>

          <nav className='font-f1 mr-auto flex text-sm'>
            {navButtons.map(button => (
              <NavLink
                key={button.to}
                to={button.to}
                className={({ isActive }) =>
                  isActive
                    ? 'relative rounded-md px-3 py-1.5 text-white no-underline transition'
                    : 'text-label-muted relative rounded-md px-3 py-1.5 no-underline transition hover:text-white'
                }
              >
                <h5>{button.label}</h5>
              </NavLink>
            ))}
          </nav>

          {isLoggedIn && (
            <button
              onClick={() => setShowTimeInput(true)}
              className='inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-100 shadow-sm transition hover:cursor-pointer hover:border-white/20 hover:bg-white/10'
            >
              <Plus size={14} />
              Register laptime
            </button>
          )}

          {!isLoggedIn ? (
            <NavLink
              to='/login'
              className='inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-100 shadow-sm transition hover:cursor-pointer hover:border-white/20 hover:bg-white/10'
            >
              <LogIn size={14} />
              Sign in
            </NavLink>
          ) : (
            <button
              onClick={logout}
              className='inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-100 shadow-sm transition hover:cursor-pointer hover:border-white/20 hover:bg-white/10'
            >
              <LogOut size={14} />
              Sign out
            </button>
          )}
        </div>
      </header>

      {showTimeInput && (
        <div className='z-100 backdrop-blur-xs fixed inset-0 left-0 top-0 flex h-dvh w-full items-center justify-center bg-black/50'>
          <div className='bg-background-secondary rounded-2xl border border-white/10 p-8 shadow-2xl'>
            <LapTimeInput onSubmit={() => setShowTimeInput(false)} />
            <button
              className='text-label-muted hover:text-accent mt-3 w-full hover:cursor-pointer'
              onClick={() => setShowTimeInput(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <main className='z-0 flex p-8' ref={containerRef}>
        <Outlet />
      </main>

      <div className='main-background fixed left-0 top-0 -z-10 h-full w-full' />
    </>
  )
}
