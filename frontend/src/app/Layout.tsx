import { LogIn, LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { isLoggedIn, logout } = useAuth()

  const navButtons = [
    { to: '/tracks', label: 'Tracks' },
    { to: '/players', label: 'Players' },
  ]

  return (
    <>
      <header className='sticky left-0 top-0 z-50 flex w-full justify-center px-4 pt-4'>
        <div className='border-stroke flex w-full max-w-5xl flex-wrap items-center justify-between rounded-3xl border bg-black/30 p-4 backdrop-blur-xl'>
          <NavLink
            to='/'
            className='flex items-baseline gap-2 text-white no-underline'
          >
            <span className='font-f1-black text-accent hidden text-4xl uppercase tracking-wider sm:block'>
              Chugmania
            </span>
            <span className='font-f1-black text-accent text-4xl uppercase tracking-wider sm:hidden'>
              CM
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
      <main className='z-0 flex p-8'>
        <Outlet />
      </main>

      <div className='main-background fixed left-0 top-0 -z-10 h-full w-full' />
    </>
  )
}
