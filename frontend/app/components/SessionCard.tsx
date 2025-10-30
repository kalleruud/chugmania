import {
  Ban,
  CalendarClock,
  CalendarPlus,
  Check,
  Edit,
  HelpCircle,
  LogIn,
  MapPin,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type {
  SessionSignup,
  SessionWithSignups,
} from '../../../common/models/session'
import { Button } from './Button'
import Tag from './Tag'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'short',
})

interface SessionCardProps {
  session: SessionWithSignups
  canManage: boolean
  isLoggedIn: boolean
  isPast: boolean
  userResponse?: SessionSignup['response']
  onEdit: () => void
  onDelete: () => void
  onCancel: () => void
  onJoin: (response: SessionSignup['response']) => void
  onLeave: () => void
  onAddCalendar: () => void
  loading: boolean
}

export function SessionCard({
  session,
  canManage,
  isLoggedIn,
  isPast,
  userResponse,
  onEdit,
  onDelete,
  onCancel,
  onJoin,
  onLeave,
  onAddCalendar,
  loading,
}: Readonly<SessionCardProps>) {
  const navigate = useNavigate()
  const date = new Date(session.date)
  const isSignedUp = userResponse !== undefined
  const rsvpCounts = {
    yes: session.signups.filter(s => s.response === 'yes').length,
    no: session.signups.filter(s => s.response === 'no').length,
    maybe: session.signups.filter(s => s.response === 'maybe').length,
  }

  const getStatusLabel = (): string => {
    if (session.status === 'cancelled') return 'Cancelled'
    if (session.status === 'tentative') return 'Tentative'
    return isPast ? 'Completed' : 'Upcoming'
  }

  const statusLabel = getStatusLabel()

  const statusClasses = {
    confirmed: 'border-stroke bg-white/5 backdrop-blur-sm',
    tentative:
      'border-dashed border-yellow-500/30 bg-yellow-500/5 opacity-75 backdrop-blur-sm',
    cancelled: 'border-stroke bg-red-500/5 opacity-50 backdrop-blur-sm',
  }

  const handleRsvpClick = (response: SessionSignup['response']): void => {
    if (userResponse === response) onLeave()
    else onJoin(response)
  }

  const navigateToDetails = () => navigate(`/sessions/${session.id}`)

  const getRsvpState = (
    response: SessionSignup['response']
  ): 'selected' | 'unselected' =>
    userResponse === response ? 'selected' : 'unselected'

  return (
    <button
      tabIndex={0}
      onClick={navigateToDetails}
      className={`border-stroke hover:border-accent/60 focus-visible:border-accent/60 focus-visible:ring-accent/40 flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 ${statusClasses[session.status] || statusClasses.confirmed}`}>
      <div className='border-b border-white/10 bg-white/10 px-6 py-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex-1'>
            <h2 className='text-lg font-bold leading-tight'>{session.name}</h2>
            {session.location && (
              <div className='text-label-muted mt-1 flex items-center gap-1 text-xs'>
                <MapPin size={14} />
                {session.location}
              </div>
            )}
          </div>
          <div className='flex items-center gap-2'>
            {canManage && (
              <>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  disabled={loading}
                  onClick={event => {
                    event.stopPropagation()
                    onEdit()
                  }}
                  aria-label='Edit session'>
                  <Edit size={16} />
                </Button>
                {session.status !== 'cancelled' && (
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    disabled={loading}
                    onClick={event => {
                      event.stopPropagation()
                      onCancel()
                    }}
                    aria-label='Cancel session'>
                    <Ban size={16} />
                  </Button>
                )}
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  disabled={loading}
                  onClick={event => {
                    event.stopPropagation()
                    onDelete()
                  }}
                  aria-label='Delete session'>
                  <Trash2 size={16} />
                </Button>
              </>
            )}
            <Tag
              variation='colored'
              selected={session.status === 'confirmed' && !isPast}>
              {statusLabel}
            </Tag>
          </div>
        </div>
      </div>

      <div className='flex-1 space-y-3 px-6 py-4'>
        <div className='text-label-muted flex items-center gap-2 text-sm'>
          <CalendarClock size={16} />
          {dateFormatter.format(date)}
        </div>

        {session.description && (
          <p className='text-label-muted text-xs leading-relaxed'>
            {session.description}
          </p>
        )}

        <div className='grid grid-cols-3 gap-3 rounded-xl bg-white/5 p-3'>
          <div className='flex flex-col items-center gap-1'>
            <div className='text-label-muted flex items-center gap-1 text-xs'>
              <Check size={14} className='text-green-500/70' />
            </div>
            <div className='text-lg font-bold'>{rsvpCounts.yes}</div>
          </div>
          <div className='flex flex-col items-center gap-1'>
            <div className='text-label-muted flex items-center gap-1 text-xs'>
              <HelpCircle size={14} className='text-yellow-500/70' />
            </div>
            <div className='text-lg font-bold'>{rsvpCounts.maybe}</div>
          </div>
          <div className='flex flex-col items-center gap-1'>
            <div className='text-label-muted flex items-center gap-1 text-xs'>
              <X size={14} className='text-red-500/70' />
            </div>
            <div className='text-lg font-bold'>{rsvpCounts.no}</div>
          </div>
        </div>
      </div>

      <div className='space-y-3 border-t border-white/10 px-6 py-4'>
        {!isPast && (
          <div className='flex gap-2'>
            {isLoggedIn && isSignedUp && (
              <>
                <Button
                  type='button'
                  size='sm'
                  state={getRsvpState('yes')}
                  disabled={loading}
                  className='flex-1'
                  onClick={event => {
                    event.stopPropagation()
                    handleRsvpClick('yes')
                  }}>
                  <Check size={16} />
                  Yes
                </Button>
                <Button
                  type='button'
                  size='sm'
                  state={getRsvpState('maybe')}
                  disabled={loading}
                  className='flex-1'
                  onClick={event => {
                    event.stopPropagation()
                    handleRsvpClick('maybe')
                  }}>
                  <HelpCircle size={16} />
                  Maybe
                </Button>
                <Button
                  type='button'
                  size='sm'
                  state={getRsvpState('no')}
                  disabled={loading}
                  className='flex-1'
                  onClick={event => {
                    event.stopPropagation()
                    handleRsvpClick('no')
                  }}>
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
                  disabled={loading}
                  className='flex-1'
                  onClick={event => {
                    event.stopPropagation()
                    onJoin('yes')
                  }}>
                  <Check size={16} />
                  Yes
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={loading}
                  className='flex-1'
                  onClick={event => {
                    event.stopPropagation()
                    onJoin('maybe')
                  }}>
                  <HelpCircle size={16} />
                  Maybe
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={loading}
                  className='flex-1'
                  onClick={event => {
                    event.stopPropagation()
                    onJoin('no')
                  }}>
                  <X size={16} />
                  No
                </Button>
              </>
            )}

            {!isLoggedIn && (
              <Button
                type='button'
                size='sm'
                className='flex-1'
                onClick={event => {
                  event.stopPropagation()
                  navigate(`/login?redirect=/sessions`)
                }}>
                <LogIn size={16} />
                Sign in to join
              </Button>
            )}

            {isLoggedIn && (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={loading}
                onClick={event => {
                  event.stopPropagation()
                  onAddCalendar()
                }}>
                <CalendarPlus size={16} />
              </Button>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
