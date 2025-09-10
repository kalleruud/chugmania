import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnection } from '../../contexts/ConnectionContext'
import {
  WS_SEARCH_TRACKS,
  WS_SEARCH_USERS,
} from '@chugmania/common/utils/constants.js'
import type { UserInfo } from '@chugmania/common/models/user.js'
import type { Track } from '@chugmania/common/models/track.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'

type Props = Readonly<{ trackId?: string }>

const maxValues = { minutes: 59, seconds: 59 }

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
  const inputClass =
    'focus:ring-accent/60 focus:border-accent h-12 w-10 rounded-md border border-white/10 bg-white/5 text-center text-lg caret-transparent outline-none transition focus:ring-2'

  const focusAt = useCallback((i: number) => {
    inputs.current[i]?.focus()
  }, [])

  const setDigitAt = useCallback((i: number, val: string) => {
    setDigits(prev => {
      const next = prev.slice()
      next[i] = val
      return next
    })
  }, [])

  const isLimitedIndex = (i: number) => i === 0 || i === 2

  const handleChange = (index: number, value: string) => {
    if (value !== '' && !DIGIT.test(value)) return
    if (value !== '' && isLimitedIndex(index) && parseInt(value, 10) > 5) return
    setDigitAt(index, value)
    if (value) focusAt(index + 1)
  }

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (DIGIT.test(e.key)) {
      e.preventDefault()
      if (isLimitedIndex(index) && parseInt(e.key, 10) > 5) return
      setDigitAt(index, e.key)
      focusAt(index + 1)
      return
    }
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) setDigitAt(index, '')
      else if (index > 0) {
        setDigitAt(index - 1, '')
        focusAt(index - 1)
      }
      return
    }
    if (e.key === 'ArrowLeft') focusAt(index - 1)
    if (e.key === 'ArrowRight') focusAt(index + 1)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = digits.map(d => d ?? '0').join('')
    const minutes = parseInt(t.slice(0, 2))
    const seconds = parseInt(t.slice(2, 4))
    const hundredths = parseInt(t.slice(4))
    if (
      minutes > maxValues.minutes ||
      seconds > maxValues.seconds ||
      (minutes === 0 && seconds === 0 && hundredths === 0)
    ) {
      alert('Invalid lap time')
      return
    }
    const time = `${t.slice(0, 2)}:${t.slice(2, 4)}.${t.slice(4)}`
    console.log({ userId, track, comment, time })
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
        if (res?.success && Array.isArray(res.tracks)) setTrackOptions(res.tracks)
      })
    }, 150)
    return () => clearTimeout(id)
  }, [trackLabel, showTrackOptions, socket])

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4'
    >
      <div className='flex items-center justify-center gap-1'>
        {digits.map((d, i) => (
          <span key={i} className='flex items-center'>
            <input
              ref={el => {
                if (el) inputs.current[i] = el
              }}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.currentTarget.select()}
              onClick={e => e.currentTarget.select()}
              className={inputClass}
              inputMode='numeric'
              pattern='[0-9]*'
              maxLength={1}
            />
            {i === 1 && <span className='text-xl'>:</span>}
            {i === 3 && <span className='text-xl'>.</span>}
          </span>
        ))}
      </div>
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
            className='focus:ring-accent/60 focus:border-accent w-full rounded-md border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
          />
          {showUserOptions && userOptions.length > 0 && (
            <div className='absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-white/10 bg-background/95 shadow-lg'>
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
                  className='hover:bg-white/10 flex w-full items-center gap-2 px-3 py-2 text-left'
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
            className='focus:ring-accent/60 focus:border-accent w-full rounded-md border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
          />
          {showTrackOptions && trackOptions.length > 0 && (
            <div className='absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-white/10 bg-background/95 shadow-lg'>
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
                  className='hover:bg-white/10 flex w-full items-center justify-between px-3 py-2 text-left'
                >
                  <span className='font-f1-bold'>{formatTrackName(t.number)}</span>
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
        className='focus:ring-accent/60 focus:border-accent rounded-md border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
      />
      <button
        type='submit'
        className='bg-accent text-background font-f1-bold rounded-md px-4 py-2 uppercase'
      >
        Submit
      </button>
    </form>
  )
}
