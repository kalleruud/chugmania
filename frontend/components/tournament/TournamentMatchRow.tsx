import type { Match } from '@common/models/match'
import type { TournamentMatch } from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentMatchRowProps = {
  tournamentMatch: TournamentMatch
  match: Match | undefined
  className?: string
}

export default function TournamentMatchRow({
  tournamentMatch,
  match,
  className,
}: Readonly<TournamentMatchRowProps>) {
  if (match) return <MatchRow item={match} className={className} />

  return (
    <div
      className={twMerge(
        'bg-background/50 flex flex-col gap-2 rounded-sm border border-dashed p-3',
        className
      )}>
      <div className='flex items-center justify-center gap-2'>
        {/* <span className='text-muted-foreground truncate text-sm'>
          {sourceA}
        </span>
        <span className='text-muted-foreground/50 font-kh-interface text-xs font-black'>
          {loc.no.match.vs}
        </span>
        <span className='text-muted-foreground truncate text-sm'>
          {sourceB}
        </span> */}
      </div>
    </div>
  )
}
