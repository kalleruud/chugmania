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
    return (
      t.number.toString().includes(term) ||
      formatTrackName(t.number).toLowerCase().includes(term) ||
      t.level.toLowerCase().includes(term) ||
      t.type.toLowerCase().includes(term) ||
      t.topTimes.some(tt => tt.user.name.toLowerCase().includes(term))
    )
  })

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
