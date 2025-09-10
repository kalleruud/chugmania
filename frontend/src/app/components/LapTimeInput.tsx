import type { Track } from '@chugmania/common/models/track.js'
import type { UserInfo } from '@chugmania/common/models/user.js'
import {
  WS_SEARCH_TRACKS,
  WS_SEARCH_USERS,
} from '@chugmania/common/utils/constants.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useConnection } from '../../contexts/ConnectionContext'

type Props = Readonly<{ trackId?: string }>

export default function LapTimeInput({ trackId }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))

  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [track, setTrack] = useState(trackId ?? '')
  const [trackLabel, setTrackLabel] = useState('')
  const [comment, setComment] = useState('')
  const inputs = useRef<HTMLInputElement[]>([])
  const { socket } = useConnection()

  const [userOptions, setUserOptions] = useState<UserInfo[]>([])
  const [trackOptions, setTrackOptions] = useState<Track[]>([])
  const [showUserOptions, setShowUserOptions] = useState(false)
  const [showTrackOptions, setShowTrackOptions] = useState(false)

  const DIGIT = /^\d$/

  const setDigitAt = useCallback((i: number, val: string) => {
    setDigits(prev => {
      const next = prev.slice()
      next[i] = val
      return next
    })
  }, [])

  function setFocus(i: number) {
    inputs.current[i]?.focus()
  }
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
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

  // Fetch options when typing (debounced)
  useEffect(() => {
    if (!showUserOptions) return
    const q = userName.trim()
    const id = window.setTimeout(() => {
      socket.emit(WS_SEARCH_USERS, { q, limit: 10 }, (res: any) => {
        if (res?.success && Array.isArray(res.users)) setUserOptions(res.users)
      })
    }, 150)
    return () => clearTimeout(id)
  }, [userName, showUserOptions, socket])

  useEffect(() => {
    if (!showTrackOptions) return
    const q = trackLabel.trim()
    const id = window.setTimeout(() => {
      socket.emit(WS_SEARCH_TRACKS, { q, limit: 10 }, (res: any) => {
        if (res?.success && Array.isArray(res.tracks))
          setTrackOptions(res.tracks)
      })
    }, 150)
    return () => clearTimeout(id)
  }, [trackLabel, showTrackOptions, socket])

  return (
    <form className='flex flex-col gap-6'>
      <div className='flex items-center justify-center gap-1'>
        {digits.map((d, i) => (
          <span key={i} className='flex items-center gap-1'>
            <input
              ref={el => {
                if (el) inputs.current[i] = el
              }}
              value={d}
              placeholder='0'
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.currentTarget.select()}
              onClick={e => e.currentTarget.select()}
              className={
                'focus:ring-accent/60 focus:border-accent font-f1-bold h-16 w-12 rounded-lg border border-white/10 bg-white/5 text-center text-2xl tabular-nums caret-transparent transition selection:bg-transparent invalid:border-red-500/30 invalid:bg-red-500/30 focus:ring-2'
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
        <div className='flex gap-2'>
          <div className='relative flex-1'>
            <input
              value={userName}
              onChange={e => {
                setUserName(e.target.value)
                setShowUserOptions(true)
              }}
              onFocus={() => setShowUserOptions(true)}
              onBlur={() => setTimeout(() => setShowUserOptions(false), 100)}
              placeholder='User'
              className='focus:ring-accent/60 focus:border-accent w-full rounded-lg border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
            />
            {showUserOptions && userOptions.length > 0 && (
              <div className='bg-background/95 absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/10 shadow-lg'>
                {userOptions.map(u => (
                  <button
                    type='button'
                    key={u.id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setUserId(u.id)
                      setUserName(u.name)
                      setShowUserOptions(false)
                    }}
                    className='flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10'
                  >
                    <span className='font-f1-bold'>{u.name}</span>
                    {u.shortName && (
                      <span className='text-white/60'>({u.shortName})</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className='relative flex-1'>
            <input
              value={trackLabel}
              onChange={e => {
                setTrackLabel(e.target.value)
                setShowTrackOptions(true)
              }}
              onFocus={() => setShowTrackOptions(true)}
              onBlur={() => setTimeout(() => setShowTrackOptions(false), 100)}
              placeholder='Track (#05)'
              className='focus:ring-accent/60 focus:border-accent w-full rounded-lg border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
            />
            {showTrackOptions && trackOptions.length > 0 && (
              <div className='bg-background/95 absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/10 shadow-lg'>
                {trackOptions.map(t => (
                  <button
                    type='button'
                    key={t.id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setTrack(t.id)
                      setTrackLabel(formatTrackName(t.number))
                      setShowTrackOptions(false)
                    }}
                    className='flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/10'
                  >
                    <span className='font-f1-bold'>
                      {formatTrackName(t.number)}
                    </span>
                    <span className='text-white/60'>
                      {t.level} · {t.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <input
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder='Comment'
          className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
        />
      </div>

      <button
        type='submit'
        className='to-accent-secondary from-accent shadow-accent/60 w-full cursor-pointer rounded-lg bg-gradient-to-br py-2 font-semibold uppercase tracking-wider shadow-[0_10px_30px_-10px_rgba(var(--color-accent),0.6)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
      >
        Submit
      </button>
    </form>
  )
}
