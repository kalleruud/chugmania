import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DetailedHTMLProps,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { twMerge } from 'tailwind-merge'
import type { PostLapTimeRequest } from '../../../common/models/requests'
import type {
  BackendResponse,
  ErrorResponse,
  GetSessionsResponse,
  GetTracksResponse,
  GetUsersResponse,
} from '../../../common/models/responses'
import type { SessionWithSignups } from '../../../common/models/session'
import type { Track } from '../../../common/models/track'
import { type UserInfo } from '../../../common/models/user'
import {
  WS_GET_SESSIONS,
  WS_GET_TRACKS,
  WS_GET_USERS,
  WS_POST_LAPTIME,
} from '../../../common/utils/constants'
import { formattedTimeToMs } from '../../../common/utils/time'
import { formatTrackName } from '../../../common/utils/track'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { Button } from './Button'
import SearchableDropdown, { type LookupItem } from './SearchableDropdown'

const cache: {
  time: string[]
  user: LookupItem | undefined
  track: LookupItem | undefined
  session: LookupItem | undefined
} = {
  time: new Array(6).fill(''),
  user: undefined,
  track: undefined,
  session: undefined,
}

type LapTimeInputProps = DetailedHTMLProps<
  React.FormHTMLAttributes<HTMLFormElement>,
  HTMLFormElement
> & {
  trackId?: Track['id']
  userId?: Track['id']
  sessionId?: SessionWithSignups['id']
}

export default function LapTimeInput({
  trackId,
  userId,
  sessionId,
  className,
  onSubmit,
}: Readonly<LapTimeInputProps>) {
  const { socket } = useConnection()
  const { user: loggedInUser } = useAuth()
  const loggedInLookup = loggedInUser
    ? ({
        id: loggedInUser.id,
        label: loggedInUser.lastName ?? loggedInUser.firstName,
      } satisfies LookupItem)
    : undefined
  const inputs = useRef<HTMLInputElement[]>([])

  const [digits, setDigits] = useState(cache.time)
  const [selectedUser, setSelectedUser] = useState(cache.user ?? loggedInLookup)
  const [selectedTrack, setSelectedTrack] = useState(cache.track)
  const [selectedSession, setSelectedSession] = useState(cache.session)
  const [comment, setComment] = useState('')

  const [users, setUsers] = useState<UserInfo[] | undefined>(undefined)
  const [tracks, setTracks] = useState<Track[] | undefined>(undefined)
  const [sessions, setSessions] = useState<SessionWithSignups[] | undefined>(
    undefined
  )
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    []
  )

  const DIGIT = /^\d$/

  const setDigitAt = useCallback((i: number, val: string) => {
    setDigits(prev => {
      const next = prev.slice()
      next[i] = val
      return next
    })
    cache.time[i] = val
  }, [])

  const clearDigits = useCallback(() => {
    const empty = new Array(6).fill('')
    cache.time = empty
    setDigits(empty)
  }, [])

  useEffect(() => {
    cache.user = selectedUser
  }, [selectedUser])

  useEffect(() => {
    cache.track = selectedTrack
  }, [selectedTrack])

  useEffect(() => {
    cache.session = selectedSession
  }, [selectedSession])

  function setFocus(i: number) {
    inputs.current[i]?.focus()
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    e.preventDefault()

    switch (e.key) {
      case 'ArrowLeft':
        setFocus(index - 1)
        break
      case 'Tab':
      case ' ':
      case 'ArrowRight':
        setFocus(index + 1)
        break
      case 'Backspace':
      case 'Delete':
        setDigitAt(index, '')
        setFocus(index - 1)
        break
      default:
        if (DIGIT.test(e.key)) {
          setDigitAt(index, e.key)
          setFocus(index + 1)
        }
    }
  }

  useEffect(() => {
    if (userId) return
    socket.emit(
      WS_GET_USERS,
      undefined,
      (r: GetUsersResponse | ErrorResponse) => {
        if (!r.success) {
          console.error(r.message)
          return globalThis.alert(r.message)
        }

        setUsers(r.users)
      }
    )
  }, [socket])

  useEffect(() => {
    if (trackId) return
    socket.emit(
      WS_GET_TRACKS,
      undefined,
      (r: GetTracksResponse | ErrorResponse) => {
        if (!r.success) {
          console.error(r.message)
          return globalThis.alert(r.message)
        }

        setTracks(r.tracks)
      }
    )
  }, [socket])

  useEffect(() => {
    socket.emit(
      WS_GET_SESSIONS,
      undefined,
      (r: GetSessionsResponse | ErrorResponse) => {
        if (!r.success) {
          console.error(r.message)
          return globalThis.alert(r.message)
        }

        setSessions(r.sessions)
        // Pre-select session if sessionId is provided
        if (sessionId && !selectedSession) {
          const session = r.sessions.find(s => s.id === sessionId)
          if (session) {
            const date = new Date(session.date)
            const subtitle = dateFormatter.format(date)
            const location = session.location ? ` • ${session.location}` : ''
            setSelectedSession({
              id: session.id,
              label: `${session.name} — ${subtitle}${location}`,
            } satisfies LookupItem)
          }
        }
      }
    )
  }, [socket, sessionId, selectedSession, dateFormatter])

  function getMs() {
    const tenMinutes = digits[0] === '' ? 0 : Number.parseInt(digits[0]) * 10
    const minutes = digits[1] === '' ? 0 : Number.parseInt(digits[1])

    const tenSeconds = digits[2] === '' ? 0 : Number.parseInt(digits[2]) * 10
    const seconds = digits[3] === '' ? 0 : Number.parseInt(digits[3])

    const tenHundredths = digits[4] === '' ? 0 : Number.parseInt(digits[4]) * 10
    const hundredths = digits[5] === '' ? 0 : Number.parseInt(digits[5])

    return formattedTimeToMs(
      tenMinutes + minutes,
      tenSeconds + seconds,
      tenHundredths + hundredths
    )
  }

  function isInputValid(): boolean {
    return !!(
      getMs() > 0 &&
      (trackId || selectedTrack) &&
      (userId || selectedUser)
    )
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const uid = userId ?? selectedUser?.id
    const tid = trackId ?? selectedTrack?.id
    if (!uid) throw new Error('No user selected')
    if (!tid) throw new Error('No track selected')

    socket.emit(
      WS_POST_LAPTIME,
      {
        duration: getMs(),
        user: uid,
        track: tid,
        session: selectedSession?.id,
        comment: comment.trim() === '' ? undefined : comment.trim(),
        amount: 0.5,
      } satisfies PostLapTimeRequest,
      (r: BackendResponse) => {
        if (!r.success) {
          console.error(r.message)
          return globalThis.alert(r.message)
        }
        clearDigits()
      }
    )
    onSubmit?.(e)
  }

  if (!loggedInUser) return undefined

  // Stable keys for each digit position to avoid using array index as key
  const DIGIT_KEYS = ['m10', 'm1', 's10', 's1', 'h1', 'h10'] as const

  return (
    <form
      className={twMerge('flex flex-col gap-6', className)}
      onSubmit={handleSubmit}>
      <div className='flex items-center justify-center gap-1'>
        {digits.map((d, i) => (
          <span key={DIGIT_KEYS[i]} className='flex items-center gap-1'>
            <input
              ref={el => {
                if (el) inputs.current[i] = el
              }}
              value={d}
              onChange={e => console.debug('Input:', e.target.value)}
              placeholder='0'
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.currentTarget.select()}
              onClick={e => e.currentTarget.select()}
              className={
                'focus:ring-accent/60 focus:border-accent font-f1-bold h-16 w-16 rounded-lg border border-white/10 bg-white/5 text-center text-2xl tabular-nums caret-transparent transition selection:bg-transparent invalid:border-red-500/30 invalid:bg-red-500/30 focus:ring-2'
              }
              inputMode='numeric'
              pattern={i === 0 || i === 2 ? '[0-5]' : '[0-9]'}
              maxLength={1}
            />
            {i === 1 && <span className='font-f1 text-2xl'>:</span>}
            {i === 3 && <span className='font-f1 text-2xl'>.</span>}
          </span>
        ))}
      </div>

      <div className='flex flex-col gap-2'>
        {(!userId || !trackId) && (
          <div className='flex gap-2'>
            {!userId && loggedInUser.role !== 'user' && (
              <SearchableDropdown
                required={true}
                placeholder='Select user'
                selected={selectedUser}
                setSelected={setSelectedUser}
                items={
                  users?.map(
                    u =>
                      ({
                        id: u.id,
                        label: u.shortName ?? u.lastName ?? u.firstName,
                      }) satisfies LookupItem
                  ) ?? []
                }
              />
            )}
            {!trackId && (
              <SearchableDropdown
                required={true}
                placeholder='Select track'
                selected={selectedTrack}
                setSelected={setSelectedTrack}
                items={
                  tracks?.map(
                    t =>
                      ({
                        id: t.id,
                        label: `${formatTrackName(t.number)} - ${t.type}:${t.level}`,
                      }) satisfies LookupItem
                  ) ?? []
                }
              />
            )}
          </div>
        )}

        <input
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder='Comment'
          className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none transition focus:ring-2'
        />
        <SearchableDropdown
          placeholder='Link to session (optional)'
          selected={selectedSession}
          setSelected={setSelectedSession}
          items={
            sessions?.map(session => {
              const date = new Date(session.date)
              const subtitle = dateFormatter.format(date)
              const location = session.location ? ` • ${session.location}` : ''
              const isUpcoming = date.getTime() >= Date.now()
              return {
                id: session.id,
                label: `${session.name} — ${subtitle}${location}`,
                featured: isUpcoming,
              } satisfies LookupItem
            }) ?? []
          }
          className='mt-2'
          emptyLabel='No sessions found'
        />
      </div>

      <Button
        type='submit'
        variant='primary'
        size='md'
        disabled={!isInputValid()}
        className='w-full'>
        Submit
      </Button>
    </form>
  )
}
