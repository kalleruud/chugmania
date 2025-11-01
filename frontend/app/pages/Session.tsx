import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  Check,
  HelpCircle,
  MapPin,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type {
  CancelSessionRequest,
  EditLapTimeRequest,
} from '../../../common/models/requests'
import type {
  BackendResponse,
  GetSessionsResponse,
} from '../../../common/models/responses'
import type {
  SessionSignup,
  SessionWithSignups,
} from '../../../common/models/session'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import { getUserFullName, type UserInfo } from '../../../common/models/user'
import {
  WS_EDIT_LAPTIME,
  WS_GET_SESSIONS,
  WS_JOIN_SESSION,
  WS_LEAVE_SESSION,
  WS_SESSIONS_UPDATED,
} from '../../../common/utils/constants'
import { formatTrackName } from '../../../common/utils/track'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { Button } from '../components/Button'
import EditLapTimeModal from '../components/EditLapTimeModal'
import LoadingView from '../components/LoadingView'
import Tag from '../components/Tag'
import TimeEntryRow from '../components/TimeEntryRow'
import TrackTag from '../components/TrackTag'

type SignupGroupKey = SessionSignup['response']

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'short',
})

const statusStyles: Record<
  SessionWithSignups['status'],
  { label: string; className: string }
> = {
  confirmed: { label: 'Confirmed', className: 'text-emerald-300' },
  tentative: { label: 'Tentative', className: 'text-amber-300' },
  cancelled: { label: 'Cancelled', className: 'text-red-400' },
}

const signupGroups: Record<
  SignupGroupKey,
  { label: string; description: string; icon: JSX.Element }
> = {
  yes: {
    label: 'Going',
    description: 'Players ready to race',
    icon: <Check size={16} className='text-emerald-400' />,
  },
  maybe: {
    label: 'Maybe',
    description: 'Players still deciding',
    icon: <HelpCircle size={16} className='text-amber-300' />,
  },
  no: {
    label: 'Not attending',
    description: 'Players sitting this one out',
    icon: <X size={16} className='text-red-400' />,
  },
}

export default function Session() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { socket } = useConnection()
  const { isLoggedIn, user } = useAuth()
  const [session, setSession] = useState<SessionWithSignups | null>(null)
  const [loading, setLoading] = useState(true)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [editingLapTime, setEditingLapTime] = useState<LeaderboardEntry | null>(
    null
  )
  const [editingLapTimeLoading, setEditingLapTimeLoading] = useState(false)

  const emit = (
    event: string,
    payload: unknown,
    cb: (r: BackendResponse) => void
  ) => {
    socket.emit(event, payload, (r: BackendResponse) => {
      if (!r.success) {
        console.error(r.message)
        globalThis.alert(r.message)
      }
      cb(r)
    })
  }

  useEffect(() => {
    if (!id) return

    socket.emit(WS_GET_SESSIONS, undefined, (r: BackendResponse) => {
      if (r?.success && 'sessions' in r) {
        const match = r.sessions.find(s => s.id === id) ?? null
        setSession(match)
      } else if (!r.success) {
        console.error(r.message)
        globalThis.alert(r.message)
      }
      setLoading(false)
    })
  }, [id, socket])

  useEffect(() => {
    const handleUpdate = (r: GetSessionsResponse) => {
      if (!r?.success || !id) return
      const updated = r.sessions.find(s => s.id === id)
      if (updated) setSession(updated)
    }

    socket.on(WS_SESSIONS_UPDATED, handleUpdate)
    return () => {
      socket.off(WS_SESSIONS_UPDATED, handleUpdate)
    }
  }, [id, socket])

  const userSignup = useMemo(() => {
    if (!session || !user) return undefined
    return session.signups.find(s => s.user.id === user.id)
  }, [session, user])

  const isPast = useMemo(() => {
    if (!session) return false
    return new Date(session.date).getTime() < Date.now()
  }, [session])

  const rsvpCounts = useMemo(() => {
    if (!session)
      return {
        yes: 0,
        maybe: 0,
        no: 0,
      }
    return session.signups.reduce(
      (acc, current) => {
        acc[current.response] += 1
        return acc
      },
      { yes: 0, maybe: 0, no: 0 } as Record<SignupGroupKey, number>
    )
  }, [session])

  const lapsByTrack = useMemo(() => {
    if (!session) return []
    const grouped = new Map<string, typeof session.lapTimes>()
    session.lapTimes.forEach(lap => {
      const trackId = lap.track.id
      if (!grouped.has(trackId)) {
        grouped.set(trackId, [])
      }
      grouped.get(trackId)!.push(lap)
    })
    return Array.from(grouped.entries()).map(([, laps]) => ({
      track: laps[0].track,
      laps: laps.sort((a, b) => {
        // Sort by duration: fastest (smallest) first, DNF (null) last
        const aDuration = a.entry.duration ?? Number.POSITIVE_INFINITY
        const bDuration = b.entry.duration ?? Number.POSITIVE_INFINITY
        return aDuration - bDuration
      }),
    }))
  }, [session])

  const openCalendar = (path: string, mode: 'subscribe' | 'download'): void => {
    const url = `${globalThis.location.origin}${path}`
    globalThis.location.href =
      mode === 'download' ? url : url.replace(/^https?:\/\//, 'webcal://')
  }

  const handleJoin = (response: SessionSignup['response']) => {
    if (!session) return
    if (!isLoggedIn) {
      globalThis.alert('Sign in to join.')
      return
    }

    setRsvpLoading(true)
    emit(WS_JOIN_SESSION, { session: session.id, response }, () =>
      setRsvpLoading(false)
    )
  }

  const handleLeave = () => {
    if (!session) return

    setRsvpLoading(true)
    emit(
      WS_LEAVE_SESSION,
      { id: session.id } satisfies CancelSessionRequest,
      () => setRsvpLoading(false)
    )
  }

  const handleRsvpClick = (response: SessionSignup['response']) => {
    if (userSignup?.response === response) {
      handleLeave()
      return
    }
    handleJoin(response)
  }

  const handleEditLapTime = (lapTime: LeaderboardEntry) => {
    setEditingLapTime(lapTime)
  }

  const handleEditLapTimeSubmit = (data: {
    duration?: number | null
    amount?: number
    comment?: string | null
    createdAt?: string
  }) => {
    if (!editingLapTime || !session) return

    setEditingLapTimeLoading(true)
    const request: EditLapTimeRequest = {
      id: editingLapTime.id,
      ...data,
    }

    emit(WS_EDIT_LAPTIME, request, () => {
      setEditingLapTimeLoading(false)
      // Re-fetch sessions to get updated lap times
      socket.emit(WS_GET_SESSIONS, undefined, (r: BackendResponse) => {
        if (r?.success && 'sessions' in r) {
          const updated = r.sessions.find(s => s.id === session.id)
          if (updated) setSession(updated)
        }
      })
      setEditingLapTime(null)
    })
  }

  const renderUserName = (userInfo: UserInfo): string => {
    const shortName = userInfo.shortName?.trim()
    if (shortName) return shortName

    const fullName = getUserFullName(userInfo)
    if (fullName) return fullName

    return userInfo.email
  }

  const renderSignupGroups = () => {
    if (!session || session.signups.length === 0)
      return (
        <div className='text-label-muted border-stroke rounded-2xl border border-dashed bg-white/5 p-6 text-center'>
          No one has signed up yet.
        </div>
      )

    return (
      <div className='grid gap-4 md:grid-cols-3'>
        {(Object.keys(signupGroups) as SignupGroupKey[]).map(key => {
          const entries = session.signups.filter(s => s.response === key)

          return (
            <section
              key={key}
              className='border-stroke bg-background/30 flex flex-col gap-3 rounded-2xl border p-4 backdrop-blur-sm'>
              <header className='flex items-center justify-between'>
                <div>
                  <h3 className='text-sm font-semibold uppercase tracking-wider'>
                    {signupGroups[key].label}
                  </h3>
                  <p className='text-label-muted text-xs'>
                    {signupGroups[key].description}
                  </p>
                </div>
                <span className='font-f1 text-lg'>{entries.length}</span>
              </header>

              <div className='space-y-2'>
                {entries.length === 0 ? (
                  <p className='text-label-muted text-xs'>No players yet.</p>
                ) : (
                  entries.map(entry => (
                    <div
                      key={entry.user.id}
                      className='border-stroke flex items-center gap-2 rounded-xl border bg-black/30 px-3 py-2'>
                      <Users size={16} className='text-label-muted shrink-0' />
                      <div className='flex-1'>
                        <p className='text-sm font-medium leading-tight'>
                          {renderUserName(entry.user)}
                        </p>
                        <p className='text-label-muted text-xs'>
                          {entry.user.email}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  const renderLapTimes = () => {
    if (!session || session.lapTimes.length === 0)
      return (
        <div className='text-label-muted border-stroke rounded-2xl border border-dashed bg-white/5 p-6 text-center'>
          No lap times recorded for this session yet.
        </div>
      )

    return (
      <div className='flex flex-col gap-4'>
        {lapsByTrack.map(trackGroup => {
          const leaderboardEntries: LeaderboardEntry[] = trackGroup.laps.map(
            lap => ({
              id: lap.entry.id,
              duration: lap.entry.duration,
              amount: lap.entry.amount,
              comment: lap.entry.comment ?? null,
              createdAt: new Date(lap.entry.createdAt),
              updatedAt: new Date(lap.entry.updatedAt ?? lap.entry.createdAt),
              deletedAt: lap.entry.deletedAt
                ? new Date(lap.entry.deletedAt)
                : null,
              user: lap.user,
              session: null,
              gap: {
                position: undefined,
              },
            })
          )

          return (
            <section
              key={trackGroup.track.id}
              className='rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.9)] sm:p-5'>
              <header className='flex flex-wrap items-baseline justify-between pb-4 sm:pb-4'>
                <div className='flex flex-col gap-2'>
                  <h3 className='text-lg font-semibold'>
                    {formatTrackName(trackGroup.track.number)}
                  </h3>
                  <p className='text-label-secondary text-xs uppercase tracking-widest'>
                    Total entries: {trackGroup.laps.length}
                  </p>
                </div>

                <div className='flex gap-2'>
                  <TrackTag trackLevel={trackGroup.track.level}>
                    {trackGroup.track.level}
                  </TrackTag>
                  <TrackTag trackType={trackGroup.track.type}>
                    {trackGroup.track.type}
                  </TrackTag>
                </div>
              </header>

              <table className='flex w-full flex-col'>
                <tbody className='flex flex-col divide-y divide-white/10'>
                  {trackGroup.laps.map((_, index) => {
                    const entry = leaderboardEntries[index]
                    const canEdit =
                      isLoggedIn &&
                      (user?.role === 'admin' ||
                        user?.role === 'moderator' ||
                        user?.id === entry.user.id)
                    return (
                      <TimeEntryRow
                        key={entry.id}
                        lapTime={entry}
                        position={index + 1}
                        className='py-2'
                        showGap={false}
                        showDate={true}
                        dateValue={entry.createdAt}
                        canEdit={canEdit}
                        onEdit={() => handleEditLapTime(entry)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </section>
          )
        })}
      </div>
    )
  }

  if (loading) return <LoadingView label='Loading session…' />

  if (!session)
    return (
      <div className='px-safe-or-4 pt-safe-or-8 flex-1 pb-24'>
        <Button
          type='button'
          variant='tertiary'
          onClick={() => navigate('/sessions')}
          className='mb-6'>
          <ArrowLeft size={16} />
          Back to sessions
        </Button>
        <div className='text-label-muted border-stroke rounded-2xl border bg-white/5 p-6 text-center'>
          We couldn’t find that session.
        </div>
      </div>
    )

  const status = statusStyles[session.status]
  const date = new Date(session.date)
  const isSignedUp = Boolean(userSignup)

  return (
    <div className='px-safe-or-4 pt-safe-or-8 flex-1 space-y-8 pb-24'>
      <Button
        type='button'
        variant='tertiary'
        onClick={() => navigate('/sessions')}
        className='hover:text-white'>
        <ArrowLeft size={16} />
        Back to sessions
      </Button>

      <header className='border-stroke bg-background/30 grid gap-4 rounded-3xl border p-6 backdrop-blur-xl lg:grid-cols-[2fr,1fr]'>
        <div className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='text-3xl font-bold leading-tight'>{session.name}</h1>
            <Tag variation='colored' className={status.className}>
              {status.label}
            </Tag>
            {isPast && (
              <Tag variation='muted' className='uppercase'>
                Completed
              </Tag>
            )}
          </div>
          <div className='text-label-muted flex flex-wrap items-center gap-3 text-sm'>
            <span className='flex items-center gap-2'>
              <CalendarClock size={16} />
              {dateFormatter.format(date)}
            </span>
            {session.location && (
              <span className='flex items-center gap-2'>
                <MapPin size={16} />
                {session.location}
              </span>
            )}
          </div>
          {session.description && (
            <p className='text-label-muted text-sm leading-relaxed'>
              {session.description}
            </p>
          )}
        </div>

        <div className='border-stroke flex flex-col gap-3 rounded-2xl border bg-black/30 p-4'>
          <div className='flex items-center justify-between'>
            <p className='text-label-muted text-xs uppercase tracking-[0.35em]'>
              RSVP status
            </p>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() =>
                openCalendar(
                  `/api/sessions/${session.id}/calendar.ics`,
                  'download'
                )
              }>
              <CalendarPlus size={16} />
              Save to calendar
            </Button>
          </div>
          <div className='grid grid-cols-3 gap-3'>
            {(Object.keys(rsvpCounts) as SignupGroupKey[]).map(key => (
              <div
                key={key}
                className='border-stroke flex flex-col items-center gap-2 rounded-xl border bg-white/5 p-3'>
                {signupGroups[key].icon}
                <span className='text-lg font-semibold'>{rsvpCounts[key]}</span>
                <span className='text-label-muted text-xs uppercase tracking-wider'>
                  {signupGroups[key].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {!isPast && (
        <section className='border-stroke bg-background/30 rounded-2xl border p-6 backdrop-blur-sm'>
          <h2 className='text-lg font-semibold'>RSVP</h2>
          <p className='text-label-muted mt-1 text-sm'>
            Let everyone know if you&apos;re joining this session.
          </p>
          <div className='mt-4 flex flex-wrap gap-3'>
            {isLoggedIn && isSignedUp && (
              <>
                <Button
                  type='button'
                  size='sm'
                  state={
                    userSignup?.response === 'yes' ? 'selected' : 'unselected'
                  }
                  disabled={rsvpLoading}
                  onClick={() => handleRsvpClick('yes')}>
                  <Check size={16} />
                  Yes
                </Button>
                <Button
                  type='button'
                  size='sm'
                  state={
                    userSignup?.response === 'maybe' ? 'selected' : 'unselected'
                  }
                  disabled={rsvpLoading}
                  onClick={() => handleRsvpClick('maybe')}>
                  <HelpCircle size={16} />
                  Maybe
                </Button>
                <Button
                  type='button'
                  size='sm'
                  state={
                    userSignup?.response === 'no' ? 'selected' : 'unselected'
                  }
                  disabled={rsvpLoading}
                  onClick={() => handleRsvpClick('no')}>
                  <X size={16} />
                  No
                </Button>
              </>
            )}

            {isLoggedIn && !isSignedUp && (
              <>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={rsvpLoading}
                  onClick={() => handleRsvpClick('yes')}>
                  <Check size={16} />
                  Yes
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={rsvpLoading}
                  onClick={() => handleRsvpClick('maybe')}>
                  <HelpCircle size={16} />
                  Maybe
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={rsvpLoading}
                  onClick={() => handleRsvpClick('no')}>
                  <X size={16} />
                  No
                </Button>
              </>
            )}

            {!isLoggedIn && (
              <Button
                type='button'
                size='sm'
                onClick={() =>
                  navigate(`/login?redirect=/sessions/${session.id}`)
                }>
                <Check size={16} />
                Sign in to RSVP
              </Button>
            )}
          </div>
        </section>
      )}

      <section className='space-y-4'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <h2 className='text-lg font-semibold'>Signups</h2>
            <p className='text-label-muted text-sm'>
              See who&apos;s in and how everyone responded.
            </p>
          </div>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={() =>
              openCalendar('/api/sessions/calendar.ics', 'subscribe')
            }>
            <CalendarPlus size={16} />
            Subscribe
          </Button>
        </div>
        {renderSignupGroups()}
      </section>

      <section className='space-y-4'>
        <div>
          <h2 className='text-lg font-semibold'>Lap times</h2>
          <p className='text-label-muted text-sm'>
            Every lap time logged during this session.
          </p>
        </div>
        {renderLapTimes()}
      </section>

      {editingLapTime && (
        <EditLapTimeModal
          isOpen={!!editingLapTime}
          lapTime={editingLapTime}
          loading={editingLapTimeLoading}
          onClose={() => setEditingLapTime(null)}
          onSubmit={handleEditLapTimeSubmit}
        />
      )}
    </div>
  )
}
