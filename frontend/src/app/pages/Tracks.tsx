import { WS_GET_TRACKS_NAME } from '@chugmania/common/models/constants.js'
import {
  isErrorResponse,
  type ErrorResponse,
  type GetTracksResponse,
} from '@chugmania/common/models/responses.js'
import {
  TRACK_LEVELS,
  TRACK_TYPES,
  type TrackSummary,
} from '@chugmania/common/models/track.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { useEffect, useState } from 'react'
import { useConnection } from '../../contexts/ConnectionContext'
import SearchBar from '../components/SearchBar'
import Spinner from '../components/Spinner'
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

  return (
    <div className='min-w-0 flex-1 space-y-4'>
      <div className='mx-auto w-full max-w-3xl'>
        <SearchBar value={search} onChange={setSearch} />
      </div>
      <div className='mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-2 md:flex-row md:justify-between'>
        <div className='flex flex-wrap justify-center gap-2'>
          {TRACK_LEVELS.map(l => (
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
        <div className='flex flex-wrap justify-center gap-2'>
          {TRACK_TYPES.map(t => (
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
        <div className='flex items-center justify-center pt-48'>
          <Spinner size={48} className='text-accent' />
        </div>
      ) : (
        <div className='grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4'>
          {filtered.map(t => (
            <TrackCard key={t.track.id} summary={t} />
          ))}
        </div>
      )}
    </div>
  )
}
