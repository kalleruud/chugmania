import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import type { GroupWithPlayers } from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type GroupCardProps = {
  group: GroupWithPlayers
  matches: Match[]
  className?: string
}

export default function GroupCard({
  group,
  matches,
  className,
}: Readonly<GroupCardProps>) {
  const { openMatch } = useTimeEntryInput()

  const sortedPlayers = [...group.players].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (a.losses !== b.losses) return a.losses - b.losses
    return a.seed - b.seed
  })

  return (
    <div
      className={twMerge(
        'bg-background flex flex-col gap-3 rounded-lg border p-3',
        className
      )}>
      <h5 className='font-f1-bold text-sm uppercase'>{group.name}</h5>

      <div className='flex flex-col gap-1'>
        <div className='text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-2 px-2 text-xs'>
          <span>Spiller</span>
          <span className='w-8 text-center'>S</span>
          <span className='w-8 text-center'>T</span>
        </div>
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={twMerge(
              'grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-sm px-2 py-1',
              index < 2 && 'bg-primary/10'
            )}>
            <div className='flex items-center gap-2'>
              <span className='text-muted-foreground w-4 text-xs'>
                {index + 1}.
              </span>
              <span className='font-kh-interface truncate text-sm'>
                {player.user.shortName ??
                  player.user.firstName ??
                  loc.no.match.unknownUser}
              </span>
            </div>
            <span className='text-primary w-8 text-center text-sm font-medium'>
              {player.wins}
            </span>
            <span className='text-muted-foreground w-8 text-center text-sm'>
              {player.losses}
            </span>
          </div>
        ))}
      </div>

      {matches.length > 0 && (
        <div className='flex flex-col gap-1'>
          <span className='text-muted-foreground px-2 text-xs'>Matcher</span>
          {matches.map(match => (
            <MatchRow
              key={match.id}
              item={match}
              className='bg-background-secondary rounded-sm p-1'
              onClick={() => openMatch(match)}
              hideTrack
            />
          ))}
        </div>
      )}
    </div>
  )
}
