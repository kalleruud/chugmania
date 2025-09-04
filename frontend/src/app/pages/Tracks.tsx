import { WS_GET_TRACKS_NAME } from '@chugmania/common/models/constants.js'
import {
  isErrorResponse,
  type ErrorResponse,
  type GetTracksResponse,
} from '@chugmania/common/models/responses.js'
import type { TrackSummary } from '@chugmania/common/models/track.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { useEffect, useState } from 'react'
import { useConnection } from '../../contexts/ConnectionContext'
import SearchBar from '../components/SearchBar'
import TagPill from '../components/TagPill'
import TrackCard from '../components/TrackCard'

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
    if (levelFilter && t.track.level !== levelFilter) return false
    if (typeFilter && t.track.type !== typeFilter) return false
    return (
      t.track.number.toString().includes(term) ||
      formatTrackName(t.track.number).toLowerCase().includes(term) ||
      t.track.level.toLowerCase().includes(term) ||
      t.track.type.toLowerCase().includes(term) ||
      t.topTimes.some(tt => tt.user.name.toLowerCase().includes(term))
    )
  })

  const levels = ['white', 'green', 'blue', 'red', 'black', 'custom']
  const types = ['drift', 'valley', 'lagoon', 'stadium']

  return (
    <div className='min-w-0 flex-1 space-y-4'>
      <div className='mx-auto w-full max-w-3xl'>
        <SearchBar value={search} onChange={setSearch} />
      </div>
      {/* Filters */}
      <div className='mx-auto w-full max-w-3xl space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-label-muted text-[11px] uppercase tracking-wider'>
            Level:
          </span>
          {levels.map(l => (
            <TagPill
              key={l}
              variant='level'
              value={l}
              selected={levelFilter !== null ? levelFilter === l : undefined}
              onClick={() => setLevelFilter(prev => (prev === l ? null : l))}
            >
              {l}
            </TagPill>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-label-muted text-[11px] uppercase tracking-wider'>
            Type:
          </span>
          {types.map(t => (
            <TagPill
              key={t}
              variant='type'
              value={t}
              selected={typeFilter !== null ? typeFilter === t : undefined}
              onClick={() => setTypeFilter(prev => (prev === t ? null : t))}
            >
              {t}
            </TagPill>
          ))}
        </div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className='grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4'>
          {filtered.map(t => (
            <TrackCard key={t.track.id} track={t} />
          ))}
        </div>
      )}
    </div>
  )
}
