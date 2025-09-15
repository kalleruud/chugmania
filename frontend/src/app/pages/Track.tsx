import type { GetLeaderboardRequest } from '@chugmania/common/models/requests.js'
import {
  type ErrorResponse,
  type GetLeaderboardsResponse,
} from '@chugmania/common/models/responses.js'
import type { LeaderboardEntry } from '@chugmania/common/models/timeEntry.js'
import type { Track } from '@chugmania/common/models/track.js'
import { WS_GET_LEADERBOARD } from '@chugmania/common/utils/constants.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConnection } from '../../contexts/ConnectionContext'
import LapTimeInput from '../components/LapTimeInput'
import LeaderboardView from '../components/Leaderboard'
import Spinner from '../components/Spinner'
import TrackTag from '../components/TrackTag'

export default function Track() {
  const { id } = useParams()
  const { socket } = useConnection()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [track, setTrack] = useState<Track | null>(null)

  useEffect(() => {
    if (!id) return
    socket.emit(
      WS_GET_LEADERBOARD,
      { trackId: id } satisfies GetLeaderboardRequest,
      (r: GetLeaderboardsResponse | ErrorResponse) => {
        if (!r.success) {
          console.error(r.message)
          window.alert(r.message)
          setLoading(false)
          return
        }
        const lb = r.leaderboards[0]
        setEntries(lb.entries)
        setTrack(lb.track)
        setLoading(false)
      }
    )
  }, [id, socket])

  if (loading)
    return (
      <div className='mt-12 flex w-full items-center justify-center'>
        <Spinner />
      </div>
    )

  if (!track) throw Error("Couldn't get track")

  return (
    <div className='sticky flex w-full gap-6'>
      <section className='flex flex-col gap-2'>
        <h1>{formatTrackName(track?.number)}</h1>
        <div className='flex gap-1'>
          <TrackTag trackLevel={track.level}>{track.level}</TrackTag>
          <TrackTag trackType={track.type}>{track.type}</TrackTag>
        </div>
      </section>

      <section className='flex w-full flex-col gap-4'>
        <LapTimeInput className='bg-background-secondary rounded-2xl border border-white/10 p-4' />
        <LeaderboardView entries={entries} />
      </section>
    </div>
  )
}
