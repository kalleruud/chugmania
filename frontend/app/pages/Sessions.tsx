import { CalendarPlus } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  BackendResponse,
  GetSessionsResponse,
} from '../../../common/models/responses'
import type { SessionWithSignups } from '../../../common/models/session'
import {
  WS_CANCEL_SESSION,
  WS_CREATE_SESSION,
  WS_DELETE_SESSION,
  WS_GET_SESSIONS,
  WS_JOIN_SESSION,
  WS_LEAVE_SESSION,
  WS_SESSIONS_UPDATED,
  WS_UPDATE_SESSION,
} from '../../../common/utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { Button } from '../components/Button'
import { EditSessionModal } from '../components/EditSessionModal'
import LoadingView from '../components/LoadingView'
import { SessionCard } from '../components/SessionCard'
import { SessionForm, type SessionFormData } from '../components/SessionForm'

const emptyForm: SessionFormData = {
  name: '',
  date: '',
  location: '',
  description: '',
}

const pad = (n: number): string => String(n).padStart(2, '0')

export default function Sessions() {
  const { socket } = useConnection()
  const { user, isLoggedIn } = useAuth()
  const [sessions, setSessions] = useState<SessionWithSignups[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<SessionFormData>(emptyForm)
  const [editForm, setEditForm] = useState<SessionFormData>(emptyForm)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState({
    creating: false,
    updating: false,
    deleting: false,
    canceling: false,
    rsvp: new Set<string>(),
  })

  const canManageSessions = user?.role === 'admin' || user?.role === 'moderator'

  const emit = (
    event: string,
    payload: any,
    cb: (r: BackendResponse) => void
  ): void => {
    socket.emit(event, payload, (r: BackendResponse) => {
      if (!r.success) {
        console.error(r.message)
        globalThis.alert(r.message)
      }
      cb(r)
    })
  }

  const isPast = (s: SessionWithSignups): boolean =>
    new Date(s.date).getTime() < Date.now()

  const formatDate = (d: Date): string =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

  const trim = (v: string): string | undefined => v.trim() || undefined

  const openCalendar = (path: string, mode: 'subscribe' | 'download'): void => {
    const url = `${globalThis.location.origin}${path}`
    globalThis.location.href =
      mode === 'download' ? url : url.replace(/^https?:\/\//, 'webcal://')
  }

  useEffect(() => {
    emit(WS_GET_SESSIONS, undefined, (r: any) => {
      if (r.success) setSessions(r.sessions)
      setLoading(false)
    })
  }, [socket])

  useEffect(() => {
    const handleUpdate = (r: GetSessionsResponse) => {
      if (r?.success) setSessions(r.sessions)
    }
    socket.on(WS_SESSIONS_UPDATED, handleUpdate)
    return () => {
      socket.off(WS_SESSIONS_UPDATED, handleUpdate)
    }
  }, [socket])

  const upcomingSessions = useMemo(
    () => sessions.filter(s => !isPast(s)),
    [sessions]
  )
  const pastSessions = useMemo(
    () => sessions.filter(s => isPast(s)),
    [sessions]
  )

  const handleCreateSession = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name.trim() || !form.date) return

    setLoadingState(p => ({ ...p, creating: true }))
    emit(
      WS_CREATE_SESSION,
      {
        name: form.name.trim(),
        date: new Date(form.date).toISOString(),
        location: trim(form.location),
        description: trim(form.description),
      },
      r => {
        setLoadingState(p => ({ ...p, creating: false }))
        if (r.success) setForm(emptyForm)
      }
    )
  }

  const handleJoin = (sessionId: string, response: 'yes' | 'no' | 'maybe') => {
    if (!isLoggedIn) {
      globalThis.alert('Sign in to join.')
      return
    }

    const rsvp = new Set(loadingState.rsvp)
    rsvp.add(sessionId)
    setLoadingState(p => ({ ...p, rsvp }))

    emit(WS_JOIN_SESSION, { session: sessionId, response }, () => {
      const rsvp = new Set(loadingState.rsvp)
      rsvp.delete(sessionId)
      setLoadingState(p => ({ ...p, rsvp }))
    })
  }

  const handleLeave = (sessionId: string) => {
    const rsvp = new Set(loadingState.rsvp)
    rsvp.add(sessionId)
    setLoadingState(p => ({ ...p, rsvp }))

    emit(WS_LEAVE_SESSION, { session: sessionId }, () => {
      const rsvp = new Set(loadingState.rsvp)
      rsvp.delete(sessionId)
      setLoadingState(p => ({ ...p, rsvp }))
    })
  }

  const handleEditClick = (s: SessionWithSignups) => {
    setEditForm({
      name: s.name,
      date: formatDate(new Date(s.date)),
      location: s.location || '',
      description: s.description || '',
    })
    setEditingSessionId(s.id)
  }

  const handleUpdateSession = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editForm.name.trim() || !editForm.date || !editingSessionId) return

    setLoadingState(p => ({ ...p, updating: true }))
    emit(
      WS_UPDATE_SESSION,
      {
        id: editingSessionId,
        name: editForm.name.trim(),
        date: new Date(editForm.date).toISOString(),
        location: trim(editForm.location),
        description: trim(editForm.description),
      },
      r => {
        setLoadingState(p => ({ ...p, updating: false }))
        if (r.success) {
          setEditingSessionId(null)
          setEditForm(emptyForm)
        }
      }
    )
  }

  const handleDelete = (id: string) => {
    if (!globalThis.confirm('Delete this session?')) return
    setLoadingState(p => ({ ...p, deleting: true }))
    emit(WS_DELETE_SESSION, { id }, () =>
      setLoadingState(p => ({ ...p, deleting: false }))
    )
  }

  const handleCancel = (id: string) => {
    if (!globalThis.confirm('Cancel this session?')) return
    setLoadingState(p => ({ ...p, canceling: true }))
    emit(WS_CANCEL_SESSION, { id }, () =>
      setLoadingState(p => ({ ...p, canceling: false }))
    )
  }

  const renderSessions = (list: SessionWithSignups[]) =>
    list.length === 0 ? (
      <div className='text-label-muted rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center'>
        No sessions yet.
      </div>
    ) : (
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        {list.map(s => {
          const userSignup = s.signups.find(x => x.user.id === user?.id)
          const isLoading = loadingState.rsvp.has(s.id)
          return (
            <SessionCard
              key={s.id}
              session={s}
              canManage={canManageSessions}
              isLoggedIn={isLoggedIn}
              isPast={isPast(s)}
              userResponse={userSignup?.response}
              onEdit={() => handleEditClick(s)}
              onDelete={() => handleDelete(s.id)}
              onCancel={() => handleCancel(s.id)}
              onJoin={r => handleJoin(s.id, r)}
              onLeave={() => handleLeave(s.id)}
              onAddCalendar={() =>
                openCalendar(`/api/sessions/${s.id}/calendar.ics`, 'download')
              }
              loading={
                isLoading || loadingState.deleting || loadingState.canceling
              }
            />
          )
        })}
      </div>
    )

  if (loading) return <LoadingView />

  return (
    <div className='px-safe-or-4 pt-safe-or-8 flex-1 space-y-10 pb-24'>
      <header className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-2 sm:max-w-2xl'>
          <h1 className='text-3xl font-semibold'>Sessions</h1>
          <p className='text-label-muted text-sm'>
            Join upcoming Trackmania gatherings. Moderators and admins create
            sessions; everyone can RSVP.
          </p>
        </div>
        <Button
          type='button'
          variant='secondary'
          className='w-full sm:w-auto'
          onClick={() =>
            openCalendar('/api/sessions/calendar.ics', 'subscribe')
          }>
          <CalendarPlus size={16} />
          Subscribe via calendar
        </Button>
      </header>

      {canManageSessions && (
        <section className='border-stroke rounded-2xl border bg-white/5 p-6 backdrop-blur-sm'>
          <h2 className='text-lg font-semibold'>Create a session</h2>
          <SessionForm
            data={form}
            onChange={setForm}
            onSubmit={handleCreateSession}
            loading={loadingState.creating}
            submitLabel='Create session'
          />
        </section>
      )}

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>Upcoming sessions</h2>
        {renderSessions(upcomingSessions)}
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>Past sessions</h2>
        {renderSessions(pastSessions)}
      </section>

      <EditSessionModal
        isOpen={editingSessionId !== null}
        data={editForm}
        loading={loadingState.updating}
        onClose={() => setEditingSessionId(null)}
        onChange={setEditForm}
        onSubmit={handleUpdateSession}
      />
    </div>
  )
}
