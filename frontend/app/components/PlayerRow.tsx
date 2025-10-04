import { Link } from 'react-router-dom'
import type { PlayerSummary } from '../../../common/models/playerSummary'
import { getUserFullName } from '../../../common/models/user'

type PlayerRowProps = Readonly<{
  summary: PlayerSummary
  isSelf?: boolean
  rank: number
}>

export default function PlayerRow({ summary, isSelf = false, rank }: PlayerRowProps) {
  const { user, averagePosition } = summary
  const name = user.lastName ?? user.shortName ?? getUserFullName(user) ?? user.email
  const averageLabel = averagePosition != null ? averagePosition.toFixed(2) : '—'

  return (
    <Link
      to={`/players/${user.id}`}
      className={`flex items-center gap-4 rounded-xl border border-transparent px-3 py-2 text-sm uppercase transition-colors hover:border-white/20 hover:bg-white/5 sm:px-4 ${
        isSelf ? 'border-accent/40 bg-accent/10' : ''
      }`}
      aria-label={`View profile for ${name}`}
    >
      <span className='text-label-muted w-12 text-xs sm:text-sm'>#{rank}</span>
      <span className='flex-1 truncate text-white'>{name}</span>
      <span className='text-label-muted w-16 text-right text-xs sm:text-sm'>
        {averageLabel}
      </span>
    </Link>
  )
}
