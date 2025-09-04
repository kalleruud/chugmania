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
import TrackCard from '../components/TrackCard'

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

  return (
    <div className='flex-1 min-w-0 space-y-4'>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder='Search tracks'
        className='w-full rounded-md border border-white/10 bg-white/5 p-2'
      />
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
