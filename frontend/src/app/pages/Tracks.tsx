import { WS_GET_TRACKS_NAME } from '@chugmania/common/models/constants.js'
import {
  isErrorResponse,
  type ErrorResponse,
  type GetTracksResponse,
} from '@chugmania/common/models/responses.js'
import type { TrackSummary } from '@chugmania/common/models/track.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { useEffect, useRef, useState } from 'react'
import { useConnection } from '../../contexts/ConnectionContext'
import TrackCard from '../components/TrackCard'
import { Search, X } from 'lucide-react'

export default function Tracks() {
  const [tracks, setTracks] = useState<TrackSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const { socket } = useConnection()

  useEffect(() => {
    socket.emit(
      WS_GET_TRACKS_NAME,
      undefined,
      (d: GetTracksResponse | ErrorResponse) => {
        if (isErrorResponse(d)) {
          console.error(d.message)
          window.alert('Failed to load tracks')
        } else {
          setTracks(d.tracks ?? [])
        }
        setLoading(false)
      }
    )
  }, [socket])

  const term = search.toLowerCase()
  const filtered = tracks.filter(t => {
    if (levelFilter && t.level !== levelFilter) return false
    if (typeFilter && t.type !== typeFilter) return false
    return (
      t.number.toString().includes(term) ||
      formatTrackName(t.number).toLowerCase().includes(term) ||
      t.level.toLowerCase().includes(term) ||
      t.type.toLowerCase().includes(term) ||
      t.topTimes.some(tt => tt.user.name.toLowerCase().includes(term))
    )
  })

  const tagBase =
    'rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wider'
  const levelClasses: Record<string, string> = {
    white: 'text-black bg-white border-white/80',
    green: 'text-green-300 bg-green-500/10 border-green-500/40',
    blue: 'text-sky-300 bg-sky-500/10 border-sky-500/40',
    red: 'text-red-300 bg-red-500/10 border-red-500/40',
    black: 'text-slate-200 bg-black/40 border-slate-600/60',
    custom: 'text-amber-300 bg-amber-500/10 border-amber-500/40',
  }
  const typeClasses: Record<string, string> = {
    drift: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/40',
    valley: 'text-lime-300 bg-lime-500/10 border-lime-500/40',
    lagoon: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/40',
    stadium: 'text-orange-300 bg-orange-500/10 border-orange-500/40',
  }
  const levels = ['white', 'green', 'blue', 'red', 'black', 'custom']
  const types = ['drift', 'valley', 'lagoon', 'stadium']

  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className='flex-1 min-w-0 space-y-4'>
      <div className='mx-auto flex w-full max-w-3xl items-center gap-3'>
        <div className='relative flex-1'>
          <Search
            size={20}
            className='text-label-muted pointer-events-none absolute left-5 top-1/2 -translate-y-1/2'
            aria-hidden='true'
          />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search tracks, types, levels, or players'
            className='focus:ring-accent/60 focus:border-accent placeholder:text-label-muted h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-12 text-base outline-none transition focus:ring-2'
            aria-label='Search tracks'
          />
          {search && (
            <button
              type='button'
              onClick={() => setSearch('')}
              className='text-label-muted hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 transition'
              aria-label='Clear search'
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      {/* Filters */}
      <div className='mx-auto w-full max-w-3xl space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-label-muted text-[11px] uppercase tracking-wider'>Level:</span>
          <button
            type='button'
            onClick={() => setLevelFilter(null)}
            className={`${tagBase} ${
              levelFilter === null
                ? 'border-white/20 bg-white/10 text-slate-200'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
            }`}
          >
            All
          </button>
          {levels.map(l => (
            <button
              key={l}
              type='button'
              onClick={() => setLevelFilter(prev => (prev === l ? null : l))}
              className={`${tagBase} ${levelClasses[l] ?? ''} ${
                levelFilter === l ? 'ring-2 ring-accent/60' : ''
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-label-muted text-[11px] uppercase tracking-wider'>Type:</span>
          <button
            type='button'
            onClick={() => setTypeFilter(null)}
            className={`${tagBase} ${
              typeFilter === null
                ? 'border-white/20 bg-white/10 text-slate-200'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
            }`}
          >
            All
          </button>
          {types.map(t => (
            <button
              key={t}
              type='button'
              onClick={() => setTypeFilter(prev => (prev === t ? null : t))}
              className={`${tagBase} ${typeClasses[t] ?? ''} ${
                typeFilter === t ? 'ring-2 ring-accent/60' : ''
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className='grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]'>
          {filtered.map(t => (
            <TrackCard key={t.id} track={t} />
          ))}
        </div>
      )}
    </div>
  )
}
