import {
  WS_GET_LEADERBOARD_NAME,
  WS_GET_TRACK_NAME,
} from '@chugmania/common/models/constants.js'
import type { TopTime, Track } from '@chugmania/common/models/track.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { formatTime } from '@chugmania/common/utils/time.js'
import {
  isErrorResponse,
  type ErrorResponse,
  type GetTrackLeaderboardResponse,
} from '@chugmania/common/models/responses.js'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConnection } from '../../contexts/ConnectionContext'

export default function Track() {
  const { id } = useParams()
  const [track, setTrack] = useState<Track | null>(null)
  const [leaderboard, setLeaderboard] = useState<TopTime[]>([])
  const [search, setSearch] = useState('')
  const [gapMode, setGapMode] = useState<'leader' | 'previous'>('leader')
  const { socket } = useConnection()

  useEffect(() => {
    if (!id) return
    socket.emit(
      WS_GET_TRACK_NAME,
      { id },
      (d: Track | ErrorResponse) => {
        if (isErrorResponse(d)) console.error(d.message)
        else setTrack(d)
      }
    )
    socket.emit(
      WS_GET_LEADERBOARD_NAME,
      { id },
      (d: GetTrackLeaderboardResponse | ErrorResponse) => {
        if (isErrorResponse(d)) console.error(d.message)
        else setLeaderboard(d.times ?? [])
      }
    )
  }, [id, socket])

  const term = search.toLowerCase()
  const filtered = leaderboard.map((t, i) => {
    const dim = term ? !t.user.name.toLowerCase().includes(term) : false
    let gap = 0
    if (gapMode === 'leader') gap = t.duration - leaderboard[0]?.duration
    else if (i > 0) gap = t.duration - leaderboard[i - 1]!.duration
    return { ...t, dim, gap }
  })

  return track ? (
    <div className='space-y-4'>
      <h2 className='font-f1-black text-accent text-2xl uppercase tracking-wider'>
        {formatTrackName(track.number)}
      </h2>
      <div className='flex gap-2'>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='Search player'
          className='flex-1 rounded-md border border-white/10 bg-white/5 p-2'
        />
        <button
          onClick={() =>
            setGapMode(gapMode === 'leader' ? 'previous' : 'leader')
          }
          className='rounded-md border border-white/10 bg-white/5 px-4'
        >
          Gap: {gapMode}
        </button>
      </div>
      <ul className='space-y-1'>
        {filtered.map((t, i) => (
          <li
            key={t.user.id}
            className={`${t.dim ? 'opacity-40' : ''} flex justify-between`}
          >
            <span>
              {i + 1}. {t.user.name}
            </span>
            <span className='flex gap-2'>
              {formatTime(t.duration)}
              {i > 0 && (
                <span className='rounded bg-white/10 px-1 text-xs'>
                  +{formatTime(t.gap)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  ) : null
}
