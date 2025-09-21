import { useEffect, useState } from 'react'
import type { TrackLevel, TrackType } from '../../../../backend/database/schema'
import type { Leaderboard } from '../../../../common/models/leaderboard'
import {
  type ErrorResponse,
  type GetLeaderboardsResponse,
} from '../../../../common/models/responses'
import { TRACK_LEVELS, TRACK_TYPES } from '../../../../common/models/track'
import { WS_GET_LEADERBOARD_SUMMARIES } from '../../../../common/utils/constants'
import { formatTrackName } from '../../../../common/utils/track'
import { useConnection } from '../../contexts/ConnectionContext'
import SearchBar from '../components/SearchBar'
import Spinner from '../components/Spinner'
import TrackCard from '../components/TrackCard'
import TrackTag from '../components/TrackTag'

export default function Tracks() {
  const [summaries, setSummaries] = useState<Leaderboard[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<TrackLevel | null>(null)
  const [typeFilter, setTypeFilter] = useState<TrackType | null>(null)
  const { socket } = useConnection()

  useEffect(() => {
    socket.emit(
      WS_GET_LEADERBOARD_SUMMARIES,
      undefined,
      (d: GetLeaderboardsResponse | ErrorResponse) => {
        if (!d.success) {
          console.error(d.message)
          return window.alert(d.message)
        }

        setSummaries(d.leaderboards)
        setLoading(false)
      }
    )
  }, [socket])

  const term = search.toLowerCase()
  const filtered = summaries.filter(t => {
    if (levelFilter && t.track.level !== levelFilter) return false
    if (typeFilter && t.track.type !== typeFilter) return false
    return (
      t.track.number.toString().includes(term) ||
      formatTrackName(t.track.number).toLowerCase().includes(term) ||
      t.track.level.toLowerCase().includes(term) ||
      t.track.type.toLowerCase().includes(term) ||
      t.entries.some(e => e.user.name.toLowerCase().includes(term))
    )
  })

  return (
    <div className='min-w-0 flex-1 space-y-8'>
      <div className='mx-auto max-w-3xl space-y-4'>
        <SearchBar value={search} onChange={setSearch} />

        <div className='mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-2 md:flex-row md:justify-between'>
          <div className='flex flex-wrap justify-center gap-2'>
            {TRACK_LEVELS.map(l => (
              <TrackTag
                key={l}
                trackLevel={l}
                selected={!levelFilter || levelFilter === l}
                onClick={() => setLevelFilter(prev => (prev === l ? null : l))}
              >
                {l}
              </TrackTag>
            ))}
          </div>
          <div className='flex flex-wrap justify-center gap-2'>
            {TRACK_TYPES.map(t => (
              <TrackTag
                key={t}
                trackType={t}
                selected={!typeFilter || typeFilter === t}
                onClick={() => setTypeFilter(prev => (prev === t ? null : t))}
              >
                {t}
              </TrackTag>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className='flex items-center justify-center pt-48'>
          <Spinner size={48} className='text-accent' />
        </div>
      ) : (
        <div className='grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4'>
          {filtered.map(t => (
            <TrackCard key={t.track.id} leaderboard={t} />
          ))}
        </div>
      )}
    </div>
  )
}
