import {
  WS_DELETE_TIME,
  WS_GET_LEADERBOARD,
  WS_LIST_TIMES,
  WS_LIST_TRACKS,
  WS_LIST_USERS,
  WS_SUBMIT_TIME,
  WS_UPDATE_TIME,
  WS_USER_TOP_TIMES,
} from '@chugmania/common/models/constants.ts'
import type {
  DeleteTimeResponse,
  GetLeaderboardResponse,
  ListTimesResponse,
  ListTracksResponse,
  ListUsersResponse,
  SubmitTimeResponse,
  UpdateTimeResponse,
  UserTopTimesResponse,
} from '@chugmania/common/models/responses.js'
import type { UserInfo } from '@chugmania/common/models/user.js'
import type {
  LeaderboardRow,
  TimeEntryRow,
  Track,
} from '@chugmania/common/models/track.ts'
import { formatLapTime, parseLapTime } from '@chugmania/common/utils/time.ts'
import {
  Trophy,
  ArrowLeft,
  Wifi,
  WifiOff,
  Pencil,
  Trash2,
  Clock,
  Send,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Login from './components/Login'
import TimeInput from './components/TimeInput'
import { useAuth } from './contexts/AuthContext'
import { useConnection } from './contexts/ConnectionContext'

export default function Home() {
  const auth = useAuth()
  const { isLoggedIn, logout, user } = auth
  const { socket, isConnected } = useConnection()
  const [tab, setTab] = useState<'tracks' | 'users'>('tracks')
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [users, setUsers] = useState<UserInfo[]>([])
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null)
  const [userTopTimes, setUserTopTimes] = useState<
    {
      track: Track
      bestTimeMs: number
    }[]
  >([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [timeInput, setTimeInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [times, setTimes] = useState<TimeEntryRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editComment, setEditComment] = useState<string>('')
  const [top3ByTrack, setTop3ByTrack] = useState<
    Record<string, LeaderboardRow[]>
  >({})
  const [searchQuery, setSearchQuery] = useState('')

  // Helpers for styled tags
  const levelTagClass = (level: Track['level']) => {
    switch (level) {
      case 'white':
        return 'bg-white/10 text-slate-100 border-white/20'
      case 'green':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      case 'blue':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30'
      case 'red':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
      case 'black':
        return 'bg-slate-800 text-slate-200 border-slate-600'
      default:
        return 'bg-white/10 text-slate-200 border-white/20'
    }
  }
  const typeTagClass = (type: Track['type']) => {
    switch (type) {
      case 'stadium':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
      case 'lagoon':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
      case 'valley':
        return 'bg-lime-500/15 text-lime-300 border-lime-500/30'
      case 'canyon':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      case 'custom':
        return 'bg-slate-600/30 text-slate-200 border-slate-500/50'
      default:
        return 'bg-white/10 text-slate-200 border-white/20'
    }
  }
  const fmtTrackNo = (n: number) => `#${String(n).padStart(2, '0')}`

  useEffect(() => {
    if (!isConnected) return
    if (tab === 'tracks') {
      socket.emit(WS_LIST_TRACKS, {}, (res: ListTracksResponse) => {
        if (!res?.success) return
        setTracks(res.tracks)
      })
    } else {
      socket.emit(
        WS_LIST_USERS,
        {},
        (res: ListUsersResponse | { success: false; message: string }) => {
          if ('success' in res && res.success) setUsers(res.users)
        }
      )
    }
  }, [isConnected, tab])

  // Load top 3 for each track to display on cards
  useEffect(() => {
    if (!tracks.length) return
    const cancelled = { v: false }
    tracks.forEach(t => {
      socket.emit(
        WS_GET_LEADERBOARD,
        { trackId: t.id },
        (res: GetLeaderboardResponse) => {
          if (cancelled.v || !res?.success) return
          setTop3ByTrack(prev => ({
            ...prev,
            [t.id]: res.leaderboard.slice(0, 3),
          }))
        }
      )
    })
    return () => {
      cancelled.v = true
    }
  }, [tracks])

  // Live updates when times change anywhere
  useEffect(() => {
    function refreshForTrack(trackId: string) {
      // Update top-3 used by cards
      socket.emit(
        WS_GET_LEADERBOARD,
        { trackId },
        (res: GetLeaderboardResponse) => {
          if (!res?.success) return
          setTop3ByTrack(prev => ({
            ...prev,
            [trackId]: res.leaderboard.slice(0, 3),
          }))
          // If this track is open, also refresh its full leaderboard and times list
          if (selectedTrack?.id === trackId) {
            setLeaderboard(res.leaderboard)
            const uid =
              isLoggedIn &&
              user &&
              user.role !== 'admin' &&
              user.role !== 'moderator'
                ? user.id
                : undefined
            socket.emit(
              WS_LIST_TIMES,
              { trackId, userId: uid },
              (
                list: ListTimesResponse | { success: false; message: string }
              ) => {
                if (list.success) setTimes(list.times)
              }
            )
          }
        }
      )
    }
    const onAdded = (payload: { trackId: string }) =>
      refreshForTrack(payload.trackId)
    const onUpdated = (payload: { trackId: string }) =>
      refreshForTrack(payload.trackId)
    const onDeleted = (payload: { trackId: string }) =>
      refreshForTrack(payload.trackId)
    socket.on('times:added', onAdded)
    socket.on('times:updated', onUpdated)
    socket.on('times:deleted', onDeleted)
    return () => {
      socket.off('times:added', onAdded)
      socket.off('times:updated', onUpdated)
      socket.off('times:deleted', onDeleted)
    }
  }, [socket, selectedTrack?.id, isLoggedIn, user?.id, user?.role])

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return tracks
    return tracks.filter(t => {
      const name = fmtTrackNo(t.number)
      const candidates = [
        name,
        name.replace('#', ''),
        String(t.number),
        String(t.number).padStart(2, '0'),
        t.type,
        t.level,
      ]
        .filter(Boolean)
        .map(s => s.toLowerCase())
      return candidates.some(s => s.includes(q))
    })
  }, [tracks, searchQuery])

  useEffect(() => {
    if (!selectedTrack) return
    socket.emit(
      WS_GET_LEADERBOARD,
      { trackId: selectedTrack.id },
      (res: GetLeaderboardResponse) => {
        if (!res?.success) return
        setLeaderboard(res.leaderboard)
      }
    )
    // also load times list (own or all depending on role)
    const userId =
      isLoggedIn && user && user.role !== 'admin' && user.role !== 'moderator'
        ? user.id
        : undefined
    socket.emit(
      WS_LIST_TIMES,
      { trackId: selectedTrack.id, userId },
      (list: ListTimesResponse | { success: false; message: string }) => {
        if (list.success) setTimes(list.times)
      }
    )
  }, [selectedTrack?.id, isLoggedIn, user?.id, user?.role])

  const isTimeValid = useMemo(() => {
    // Allow empty as valid; treated as 0 on submit
    if (timeInput === '' || timeInput == null) return true
    try {
      return parseLapTime(timeInput) >= 0
    } catch {
      return false
    }
  }, [timeInput])

  const submitTime = () => {
    setError(null)
    if (!selectedTrack) return
    if (!isLoggedIn) {
      setShowLogin(true)
      return
    }
    try {
      // validate (treat empty as zeros)
      const candidate =
        timeInput && timeInput.length > 0 ? timeInput : '0:00.00'
      parseLapTime(candidate)
    } catch (e: any) {
      setError(e.message)
      return
    }
    socket.emit(
      WS_SUBMIT_TIME,
      {
        trackId: selectedTrack.id,
        time: timeInput && timeInput.length > 0 ? timeInput : '0:00.00',
      },
      (res: SubmitTimeResponse | { success: false; message: string }) => {
        if (!res.success) {
          setError(res.message)
          return
        }
        setTimeInput('')
        // Refresh leaderboard
        socket.emit(
          WS_GET_LEADERBOARD,
          { trackId: selectedTrack.id },
          (lb: GetLeaderboardResponse) =>
            lb.success && setLeaderboard(lb.leaderboard)
        )
        // Refresh times list
        const userId =
          isLoggedIn &&
          user &&
          user.role !== 'admin' &&
          user.role !== 'moderator'
            ? user.id
            : undefined
        socket.emit(
          WS_LIST_TIMES,
          { trackId: selectedTrack.id, userId },
          (list: ListTimesResponse | { success: false; message: string }) => {
            if (list.success) setTimes(list.times)
          }
        )
      }
    )
  }

  const beginEdit = (row: TimeEntryRow) => {
    setEditingId(row.id)
    setEditValue(formatLapTime(row.duration))
    setEditComment(row.comment ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
    setEditComment('')
  }

  const saveEdit = () => {
    if (!editingId || !selectedTrack) return
    socket.emit(
      WS_UPDATE_TIME,
      { timeEntryId: editingId, time: editValue, comment: editComment },
      (res: UpdateTimeResponse | { success: false; message: string }) => {
        if (!('success' in res) || !res.success) {
          setError((res as any).message ?? 'Failed to update')
          return
        }
        cancelEdit()
        // refresh
        const userId =
          isLoggedIn &&
          user &&
          user.role !== 'admin' &&
          user.role !== 'moderator'
            ? user.id
            : undefined
        socket.emit(
          WS_LIST_TIMES,
          { trackId: selectedTrack.id, userId },
          (list: ListTimesResponse | { success: false; message: string }) => {
            if (list.success) setTimes(list.times)
          }
        )
        socket.emit(
          WS_GET_LEADERBOARD,
          { trackId: selectedTrack.id },
          (lb: GetLeaderboardResponse) =>
            lb.success && setLeaderboard(lb.leaderboard)
        )
      }
    )
  }

  const deleteRow = (id: string) => {
    if (!selectedTrack) return
    if (!confirm('Delete this time?')) return
    socket.emit(
      WS_DELETE_TIME,
      { timeEntryId: id },
      (res: DeleteTimeResponse | { success: false; message: string }) => {
        if (!('success' in res) || !res.success) {
          setError((res as any).message ?? 'Failed to delete')
          return
        }
        const userId =
          isLoggedIn &&
          user &&
          user.role !== 'admin' &&
          user.role !== 'moderator'
            ? user.id
            : undefined
        socket.emit(
          WS_LIST_TIMES,
          { trackId: selectedTrack.id, userId },
          (list: ListTimesResponse | { success: false; message: string }) => {
            if (list.success) setTimes(list.times)
          }
        )
        socket.emit(
          WS_GET_LEADERBOARD,
          { trackId: selectedTrack.id },
          (lb: GetLeaderboardResponse) =>
            lb.success && setLeaderboard(lb.leaderboard)
        )
      }
    )
  }

  return (
    <div className='min-h-svh w-full text-slate-100 safe-area'>
      <div className='mx-3 sm:mx-6 my-3 sm:my-6'>
        <header className='sticky top-[var(--safe-top)] z-40 mb-3 sm:mb-4'>
          <div className='backdrop-blur-md bg-black/30 border border-white/10 rounded-xl px-3 sm:px-4 py-2'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
              <div className='flex items-center gap-2 sm:gap-4'>
                <h1 className='text-xl sm:text-2xl font-extrabold tracking-wider uppercase text-[var(--f1-accent)]'>
                  Chugmania
                </h1>
              </div>
              <div className='flex items-center gap-2 sm:gap-3 text-xs sm:text-sm w-full sm:w-auto justify-between sm:justify-end'>
                <span
                  className={`inline-flex items-center gap-1 shrink-0 ${isConnected ? 'text-green-400' : 'text-red-400'}`}
                >
                  {isConnected ? (
                    <Wifi className='size-4' />
                  ) : (
                    <WifiOff className='size-4' />
                  )}
                  {isConnected ? 'Online' : 'Offline'}
                </span>
                {isLoggedIn ? (
                  <button
                    onClick={logout}
                    className='px-2 sm:px-3 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/10'
                  >
                    Logout
                  </button>
                ) : (
                  <button
                    onClick={() => setShowLogin(true)}
                    className='px-2 sm:px-3 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/10'
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Primary nav moved out of the header for cleaner mobile layout */}
        <nav className='mb-4 flex items-center gap-2 text-sm'>
          <button
            className={`px-3 py-1 rounded-md border ${tab === 'tracks' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            onClick={() => {
              setSelectedTrack(null)
              setTab('tracks')
            }}
          >
            Tracks
          </button>
          <button
            className={`px-3 py-1 rounded-md border ${tab === 'users' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            onClick={() => {
              setSelectedUser(null)
              setTab('users')
            }}
          >
            Users
          </button>
        </nav>

        <div className='grid grid-cols-1 gap-6'>
          {tab === 'tracks' && !selectedTrack ? (
            <main>
              <div className='flex items-center justify-between mb-3 gap-3'>
                <h2 className='font-semibold text-slate-300 uppercase text-xs'>
                  Tracks
                </h2>
                <div className='relative w-full max-w-xs'>
                  <Search className='absolute left-2 top-1/2 -translate-y-1/2 size-4 text-slate-400' />
                  <input
                    type='text'
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder='Search #05, stadium, red...'
                    className='w-full pl-8 pr-3 py-2 rounded-md bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-[var(--f1-accent)]/60 text-sm'
                  />
                </div>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                {filteredTracks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTrack(t)}
                    className='text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4 shadow-2xl'
                  >
                    <div className='flex items-center justify-between mb-2'>
                      <span className='text-xl font-extrabold tracking-wide'>
                        {fmtTrackNo(t.number)}
                      </span>
                      {t.isChuggable && (
                        <span className='text-[10px] uppercase text-[var(--f1-accent)] font-bold'>
                          Chuggable
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-2 mb-3'>
                      <span
                        className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${typeTagClass(t.type)}`}
                      >
                        {t.type}
                      </span>
                      <span
                        className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${levelTagClass(t.level)}`}
                      >
                        {t.level}
                      </span>
                    </div>
                    <div>
                      <div className='text-xs uppercase text-slate-400 mb-1 inline-flex items-center gap-1'>
                        <Trophy className='size-3.5 text-yellow-400' /> Top 3
                      </div>
                      <ul className='space-y-1'>
                        {(top3ByTrack[t.id] ?? []).map((row, idx) => (
                          <li
                            key={row.user.id}
                            className='flex items-center justify-between'
                          >
                            <div className='flex items-center gap-2'>
                              <span className='text-slate-400 w-4 text-right'>
                                {idx + 1}
                              </span>
                              <span className='font-medium text-sm'>
                                {row.user.shortName ?? row.user.name}
                              </span>
                            </div>
                            <span className='font-mono text-sm'>
                              {formatLapTime(row.bestTimeMs)}
                            </span>
                          </li>
                        ))}
                        {(top3ByTrack[t.id] ?? []).length === 0 && (
                          <li className='text-slate-400 text-sm'>
                            No times yet
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className='mt-4 text-[10px] uppercase text-slate-300'>
                      Click to view details
                    </div>
                  </button>
                ))}
                {filteredTracks.length === 0 && (
                  <div className='px-4 py-3 text-slate-400 text-sm'>
                    No tracks yet
                  </div>
                )}
              </div>
            </main>
          ) : tab === 'tracks' && selectedTrack ? (
            <main>
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <h2 className='text-2xl font-extrabold tracking-wide'>
                      {fmtTrackNo(selectedTrack.number)}
                    </h2>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${typeTagClass(
                          selectedTrack.type
                        )}`}
                      >
                        {selectedTrack.type}
                      </span>
                      <span
                        className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${levelTagClass(
                          selectedTrack.level
                        )}`}
                      >
                        {selectedTrack.level}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTrack(null)}
                    className='px-3 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/10 text-sm inline-flex items-center gap-2'
                  >
                    <ArrowLeft className='size-4' /> Back to Tracks
                  </button>
                </div>

                <div className='rounded-xl border border-white/10 bg-white/5 overflow-hidden'>
                  <div className='px-4 py-2 text-xs uppercase text-slate-400 border-b border-white/10'>
                    Leaderboard (best per user)
                  </div>
                  <ul className='divide-y divide-white/10'>
                    {leaderboard.map((row, idx) => (
                      <li
                        key={row.user.id}
                        className='flex items-center justify-between px-4 py-3'
                      >
                        <div className='flex items-center gap-3'>
                          <span className='text-slate-400 w-6 text-right'>
                            {idx + 1}
                          </span>
                          <span className='font-medium'>
                            {row.user.shortName ?? row.user.name}
                          </span>
                        </div>
                        <span className='font-mono'>
                          {formatLapTime(row.bestTimeMs)}
                        </span>
                      </li>
                    ))}
                    {leaderboard.length === 0 && (
                      <li className='px-4 py-3 text-slate-400 text-sm'>
                        No times yet
                      </li>
                    )}
                  </ul>
                </div>

                <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
                  <h3 className='text-sm font-semibold mb-2'>
                    Submit lap time
                  </h3>
                  <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
                    <div className='flex items-center gap-2 max-w-full overflow-x-auto'>
                      <Clock className='size-4 text-slate-400' />
                      <TimeInput value={timeInput} onChange={setTimeInput} />
                    </div>
                    <button
                      onClick={submitTime}
                      disabled={!isTimeValid}
                      className='shrink-0 px-3 py-2 rounded-md bg-gradient-to-r from-[var(--f1-accent)] to-[#ff3b2f] disabled:opacity-50 inline-flex items-center gap-2'
                    >
                      <Send className='size-4' /> Submit
                    </button>
                  </div>
                  {error && (
                    <p className='text-red-300 text-xs mt-2'>{error}</p>
                  )}
                  {!isLoggedIn && (
                    <p className='text-slate-400 text-xs mt-2'>
                      Sign in to submit a time.
                    </p>
                  )}
                </div>

                <div className='rounded-xl border border-white/10 bg-white/5 overflow-hidden'>
                  <div className='px-4 py-2 text-xs uppercase text-slate-400 border-b border-white/10'>
                    {!isLoggedIn ||
                    (user &&
                      (user.role === 'admin' || user.role === 'moderator'))
                      ? 'All Times'
                      : 'Your Times'}
                  </div>
                  <ul className='divide-y divide-white/10'>
                    {times.map(row => (
                      <li key={row.id} className='px-4 py-3'>
                        {editingId === row.id ? (
                          <div className='flex items-center gap-3'>
                            <TimeInput
                              value={editValue}
                              onChange={setEditValue}
                            />
                            <input
                              type='text'
                              value={editComment}
                              onChange={e => setEditComment(e.target.value)}
                              placeholder='Comment (optional)'
                              className='flex-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 outline-none'
                            />
                            <button
                              onClick={saveEdit}
                              className='px-3 py-1 rounded-md bg-white/10 border border-white/10'
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className='px-3 py-1 rounded-md bg-white/10 border border-white/10'
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-3'>
                              <span className='text-slate-400 text-xs'>
                                {new Date(row.createdAt).toLocaleString()}
                              </span>
                              <span className='font-mono'>
                                {formatLapTime(row.duration)}
                              </span>
                              {row.comment && (
                                <span className='text-slate-300 text-sm'>
                                  • {row.comment}
                                </span>
                              )}
                            </div>
                            <div className='flex items-center gap-2'>
                              {isLoggedIn &&
                                ((user &&
                                  (user.role === 'admin' ||
                                    user.role === 'moderator')) ||
                                  (user && user.id === row.user.id)) && (
                                  <>
                                    <button
                                      onClick={() => beginEdit(row)}
                                      className='px-2 py-1 rounded-md bg-white/10 border border-white/10 text-xs inline-flex items-center gap-1'
                                    >
                                      <Pencil className='size-3.5' /> Edit
                                    </button>
                                    <button
                                      onClick={() => deleteRow(row.id)}
                                      className='px-2 py-1 rounded-md bg-white/10 border border-white/10 text-xs inline-flex items-center gap-1'
                                    >
                                      <Trash2 className='size-3.5' /> Delete
                                    </button>
                                  </>
                                )}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                    {times.length === 0 && (
                      <li className='px-4 py-3 text-slate-400 text-sm'>
                        No times yet
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </main>
          ) : tab === 'users' && !selectedUser ? (
            <main>
              <h2 className='font-semibold text-slate-300 uppercase text-xs mb-3'>
                Users
              </h2>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u)
                      socket.emit(
                        WS_USER_TOP_TIMES,
                        { userId: u.id },
                        (
                          res:
                            | UserTopTimesResponse
                            | { success: false; message: string }
                        ) => {
                          if ('success' in res && res.success)
                            setUserTopTimes(res.results as any)
                        }
                      )
                    }}
                    className='text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4 shadow-2xl'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <span className='text-base font-bold'>{u.name}</span>
                        {u.shortName && (
                          <span className='text-[10px] uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5'>
                            {u.shortName}
                          </span>
                        )}
                      </div>
                      <span className='text-[10px] uppercase text-slate-400'>
                        {u.role}
                      </span>
                    </div>
                  </button>
                ))}
                {users.length === 0 && (
                  <div className='px-4 py-3 text-slate-400 text-sm'>
                    No users
                  </div>
                )}
              </div>
            </main>
          ) : (
            <main>
              {selectedUser && (
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <h2 className='text-2xl font-extrabold tracking-wide'>
                        {selectedUser.name}
                      </h2>
                      {selectedUser.shortName && (
                        <span className='text-[10px] uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5'>
                          {selectedUser.shortName}
                        </span>
                      )}
                      <span className='text-[10px] uppercase text-slate-400'>
                        {selectedUser.role}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className='px-3 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/10 text-sm inline-flex items-center gap-2'
                    >
                      <ArrowLeft className='size-4' /> Back to Users
                    </button>
                  </div>

                  <div className='rounded-xl border border-white/10 bg-white/5 overflow-hidden'>
                    <div className='px-4 py-2 text-xs uppercase text-slate-400 border-b border-white/10'>
                      Top Time Per Track
                    </div>
                    <ul className='divide-y divide-white/10'>
                      {userTopTimes.map(({ track, bestTimeMs }) => (
                        <li
                          key={track.id}
                          className='flex items-center justify-between px-4 py-3'
                        >
                          <div className='flex items-center gap-3'>
                            <span className='font-semibold'>
                              {fmtTrackNo(track.number)}
                            </span>
                            <span
                              className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${typeTagClass(track.type)}`}
                            >
                              {track.type}
                            </span>
                            <span
                              className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${levelTagClass(track.level)}`}
                            >
                              {track.level}
                            </span>
                          </div>
                          <span className='font-mono'>
                            {formatLapTime(bestTimeMs)}
                          </span>
                        </li>
                      ))}
                      {userTopTimes.length === 0 && (
                        <li className='px-4 py-3 text-slate-400 text-sm'>
                          No times yet
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </main>
          )}
        </div>
      </div>

      {showLogin && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50'>
          <div className='bg-[#0d0f12] rounded-2xl shadow-2xl w-full max-w-md relative'>
            <button
              className='absolute top-2 right-2 text-slate-400 hover:text-slate-200'
              onClick={() => setShowLogin(false)}
            >
              ✕
            </button>
            <Login />
          </div>
        </div>
      )}
    </div>
  )
}
