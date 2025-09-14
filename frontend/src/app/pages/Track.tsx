import type { GetLeaderboardRequest } from '@chugmania/common/models/requests.js'
import {
  type ErrorResponse,
  type GetLeaderboardsResponse,
} from '@chugmania/common/models/responses.js'
import type { LeaderboardEntry } from '@chugmania/common/models/timeEntry.js'
import { WS_GET_LEADERBOARD } from '@chugmania/common/utils/constants.js'
import { useCallback, useEffect, useState } from 'react'
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

  const load = useCallback(() => {
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

  useEffect(() => {
    if (!id) return
    setEntries([])
    load()
  }, [id, load])

  return (
    <div className='flex w-full flex-col col-auto gap-6'>
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
