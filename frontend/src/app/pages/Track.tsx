import type {
  GetLeaderboardRequest,
  GetTrackRequest,
} from '@chugmania/common/models/requests.js'
import {
  type ErrorResponse,
  type GetLeaderboardsResponse,
  type GetTrackResponse,
} from '@chugmania/common/models/responses.js'
import type { LeaderboardEntry } from '@chugmania/common/models/timeEntry.js'
import type { Track } from '@chugmania/common/models/track.js'
import {
  WS_GET_LEADERBOARD,
  WS_GET_TRACK,
} from '@chugmania/common/utils/constants.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConnection } from '../../contexts/ConnectionContext'
import LapTimeInput from '../components/LapTimeInput'
import LeaderboardView from '../components/Leaderboard'
import Spinner from '../components/Spinner'
import Tag from '../components/Tag'

export default function Track() {
  const { id } = useParams()
  const { socket } = useConnection()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [track, setTrack] = useState<Track | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    socket.emit(
      WS_GET_TRACK,
      { trackId: id } satisfies GetTrackRequest,
      (r: GetTrackResponse | ErrorResponse) => {
        if (!r.success) {
          console.error(r.message)
          window.alert(r.message)
          setLoading(false)
          return
        }
        setTrack(r.track)
        setLoading(false)
      }
    )
  }, [id, socket])

  useEffect(() => {
    if (!id) return
    setLoading(true)
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
        setLoading(false)
      }
    )
  }, [id, socket])

  return (
    <div className='col-auto flex w-full flex-col gap-6'>
      <section className='rounded-2xl border border-white/10 bg-white/5 p-5'>
        <header className='mb-3 flex items-center justify-between border-b border-white/10 pb-2'>
          <h2 className='font-f1 text-lg uppercase tracking-wider'>Track</h2>
        </header>
        {track ? (
          <div className='flex flex-wrap items-center gap-3'>
            <div className='font-f1-italic text-2xl uppercase'>
              {formatTrackName(track.number)}
            </div>
            <Tag variation='colored' aria-label='Track level'>
              {track.level}
            </Tag>
            <Tag variation='colored' aria-label='Track type'>
              {track.type}
            </Tag>
            {track.isChuggable && (
              <Tag className='uppercase' aria-label='Chuggable track'>
                Chuggable
              </Tag>
            )}
          </div>
        ) : (
          <div className='text-label-muted'>Loading track details…</div>
        )}
      </section>
      <section className='rounded-2xl border border-white/10 bg-white/5 px-5 pb-5 pt-10'>
        <LapTimeInput trackId={id} />
      </section>

      <section className='rounded-2xl border border-white/10 bg-white/5 p-5'>
        <header className='flex items-center justify-between border-b border-white/10 px-2 pb-2'>
          <h2 className='font-f1 text-lg uppercase tracking-wider'>
            Leaderboard
          </h2>
          <Tag variation='muted' aria-label='Entries shown'>
            {entries.length} entries
          </Tag>
        </header>

        <div className='relative'>
          <LeaderboardView entries={entries} />
          {loading && (
            <div className='flex justify-center p-4'>
              <Spinner size={24} className='text-accent' />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
