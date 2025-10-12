import { CalendarClock, MapPin, Users as UsersIcon } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  BackendResponse,
  ErrorResponse,
  GetSessionsResponse,
} from '../../../common/models/responses'
import type { SessionWithSignups } from '../../../common/models/session'
import { getUserFullName } from '../../../common/models/user'
import {
  WS_CREATE_SESSION,
  WS_GET_SESSIONS,
  WS_JOIN_SESSION,
  WS_LEAVE_SESSION,
} from '../../../common/utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { Button } from '../components/Button'
import LoadingView from '../components/LoadingView'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'short',
})

function getAttendeeLabel(attendee: SessionWithSignups['signups'][number]) {
  return (
    attendee.user.shortName ??
    getUserFullName(attendee.user).replace(/\s+/g, ' ')
  )
}

function hasSessionPassed(session: SessionWithSignups) {
  return new Date(session.date).getTime() < Date.now()
}

export default function Sessions() {
  const { socket } = useConnection()
  const { user, isLoggedIn } = useAuth()
  const [sessions, setSessions] = useState<SessionWithSignups[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', date: '', location: '' })

  const canManageSessions = user?.role === 'admin' || user?.role === 'moderator'

  const refreshSessions = (showLoader = false) => {
    if (showLoader) setLoading(true)
    socket.emit(
      WS_GET_SESSIONS,
      undefined,
      (response: GetSessionsResponse | ErrorResponse) => {
        if (!response.success) {
          console.error(response.message)
          globalThis.alert(response.message)
          setLoading(false)
          return
        }

        setSessions(response.sessions)
        setLoading(false)
      }
    )
  }

  useEffect(() => {
    refreshSessions(true)
  }, [socket])

  const upcomingSessions = useMemo(
    () => sessions.filter(session => !hasSessionPassed(session)),
    [sessions]
  )
  const pastSessions = useMemo(
    () => sessions.filter(session => hasSessionPassed(session)),
    [sessions]
  )

  function handleCreateSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.name.trim() || !form.date) return

    setCreating(true)
    socket.emit(
      WS_CREATE_SESSION,
      {
        name: form.name.trim(),
        date: new Date(form.date).toISOString(),
        location: form.location.trim() ? form.location.trim() : undefined,
      },
      (response: BackendResponse) => {
        setCreating(false)
        if (!response.success) {
          console.error(response.message)
          return globalThis.alert(response.message)
        }

        setForm({ name: '', date: '', location: '' })
        refreshSessions()
      }
    )
  }

  function handleJoin(sessionId: string) {
    if (!isLoggedIn)
      return globalThis.alert('Please sign in to join a session.')
    setActiveSessionId(sessionId)
    socket.emit(WS_JOIN_SESSION, { sessionId }, (response: BackendResponse) => {
      setActiveSessionId(null)
      if (!response.success) {
        console.error(response.message)
        return globalThis.alert(response.message)
      }

      refreshSessions()
    })
  }

  function handleLeave(sessionId: string) {
    if (!isLoggedIn) return
    setActiveSessionId(sessionId)
    socket.emit(
      WS_LEAVE_SESSION,
      { sessionId },
      (response: BackendResponse) => {
        setActiveSessionId(null)
        if (!response.success) {
          console.error(response.message)
          return globalThis.alert(response.message)
        }

        refreshSessions()
      }
    )
  }

  function renderSession(session: SessionWithSignups) {
    const date = new Date(session.date)
    const isPast = hasSessionPassed(session)
    const attendeeNames = session.signups.map(getAttendeeLabel)
    const isSignedUp =
      !!user && session.signups.some(s => s.user.id === user.id)
    const visibleAttendees = attendeeNames.slice(0, 6)
    const remainingAttendees = Math.max(
      0,
      attendeeNames.length - visibleAttendees.length
    )

    return (
      <div
        key={session.id}
        className='border-stroke flex flex-col gap-4 rounded-2xl border bg-white/5 p-6 backdrop-blur-sm transition hover:border-white/15 hover:bg-white/10'>
        <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-start'>
          <div className='flex flex-col gap-1'>
            <h2 className='text-xl font-semibold'>{session.name}</h2>
            <div className='text-label-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
              <span className='flex items-center gap-1'>
                <CalendarClock size={16} />
                {dateFormatter.format(date)}
              </span>
              {session.location && (
                <span className='flex items-center gap-1'>
                  <MapPin size={16} />
                  {session.location}
                </span>
              )}
              <span
                className={
                  isPast
                    ? 'text-label-muted rounded-full bg-white/10 px-3 py-1 text-xs uppercase'
                    : 'bg-accent rounded-full px-3 py-1 text-xs uppercase text-black'
                }>
                {isPast ? 'Completed' : 'Upcoming'}
              </span>
            </div>
          </div>
          <div className='text-label-muted flex items-center gap-2 text-sm'>
            <UsersIcon size={18} />
            <span>{session.signups.length} joined</span>
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          {visibleAttendees.length === 0 ? (
            <span className='text-label-muted text-sm'>No sign-ups yet.</span>
          ) : (
            <>
              {visibleAttendees.map(name => (
                <span
                  key={name}
                  className='rounded-full bg-white/10 px-3 py-1 text-sm text-white/90'>
                  {name}
                </span>
              ))}
              {remainingAttendees > 0 && (
                <span className='text-label-muted text-sm'>
                  +{remainingAttendees} more
                </span>
              )}
            </>
          )}
        </div>

        <div className='flex flex-wrap gap-2'>
          {!isLoggedIn ? (
            <span className='text-label-muted text-sm'>
              Sign in to manage your attendance.
            </span>
          ) : isSignedUp ? (
            <Button
              type='button'
              variant='secondary'
              disabled={isPast || activeSessionId === session.id}
              onClick={() => handleLeave(session.id)}>
              Cancel attendance
            </Button>
          ) : (
            <Button
              type='button'
              onClick={() => handleJoin(session.id)}
              disabled={isPast || activeSessionId === session.id}>
              Sign up
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <LoadingView />

  return (
    <div className='p-safe-or-4 flex-1 space-y-10'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-semibold'>Sessions</h1>
        <p className='text-label-muted max-w-2xl text-sm'>
          Join upcoming Trackmania gatherings and keep track of who is
          attending. Moderators and admins can create new sessions, and everyone
          can register their participation before the event kicks off.
        </p>
      </header>

      {canManageSessions && (
        <section className='border-stroke rounded-2xl border bg-white/5 p-6 backdrop-blur-sm'>
          <h2 className='text-lg font-semibold'>Create a session</h2>
          <form
            className='mt-4 grid gap-4 sm:grid-cols-2'
            onSubmit={handleCreateSession}>
            <label className='flex flex-col gap-2 text-sm'>
              <span className='text-label-muted'>Session name</span>
              <input
                required
                type='text'
                value={form.name}
                onChange={e =>
                  setForm(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder='Trackmania Turbo LAN'
                className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none transition focus:ring-2'
              />
            </label>
            <label className='flex flex-col gap-2 text-sm'>
              <span className='text-label-muted'>Date & time</span>
              <input
                required
                type='datetime-local'
                value={form.date}
                onChange={e =>
                  setForm(prev => ({ ...prev, date: e.target.value }))
                }
                className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none transition focus:ring-2'
              />
            </label>
            <label className='flex flex-col gap-2 text-sm sm:col-span-2'>
              <span className='text-label-muted'>Location (optional)</span>
              <input
                type='text'
                value={form.location}
                onChange={e =>
                  setForm(prev => ({ ...prev, location: e.target.value }))
                }
                placeholder='Oslo, Norway'
                className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none transition focus:ring-2'
              />
            </label>
            <div className='sm:col-span-2'>
              <Button type='submit' disabled={creating}>
                {creating ? 'Creating…' : 'Create session'}
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-semibold'>Upcoming sessions</h2>
          <Button
            type='button'
            variant='tertiary'
            onClick={() => refreshSessions()}>
            Refresh
          </Button>
        </div>
        {upcomingSessions.length === 0 ? (
          <div className='text-label-muted rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center'>
            No upcoming sessions yet. Check back later!
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            {upcomingSessions.map(renderSession)}
          </div>
        )}
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>Past sessions</h2>
        {pastSessions.length === 0 ? (
          <div className='text-label-muted rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center'>
            No sessions have been completed yet.
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            {pastSessions.map(renderSession)}
          </div>
        )}
      </section>
    </div>
  )
}
