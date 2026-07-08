import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { TournamentWithDetails } from '@common/models/tournament'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

type GroupCardProps = {
  group: TournamentWithDetails['groups'][number]
  advancementCount: TournamentWithDetails['advancementCount']
  className?: string
} & ComponentProps<'div'>

export default function GroupCard({
  group,
  advancementCount,
  className,
  ...props
}: Readonly<GroupCardProps>) {
  const { users } = useData()

  const sortedPlayers = group.players.toSorted((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (a.losses !== b.losses) return a.losses - b.losses
    return 0
  })

  return (
    <div
      className={twMerge(
        'flex flex-col gap-2 rounded-lg border bg-background p-4',
        className
      )}
      {...props}>
      <div className='flex items-baseline justify-between'>
        <h3 className='text-lg'>{group.name}</h3>
        <p className='text-sm text-muted-foreground'>
          {sortedPlayers.length} spillere
        </p>
      </div>

      <div className='flex flex-col gap-1'>
        <div className='flex items-center justify-between gap-2 px-2 text-sm text-muted-foreground'>
          <span>Spiller</span>
          <div className='flex items-center gap-4'>
            <span className='w-8 text-end'>S</span>
            <span className='w-4 text-end'>W</span>
            <span className='w-4 text-end'>L</span>
          </div>
        </div>

        {sortedPlayers.map(({ user, wins, losses, seed }, index) => (
          <div
            key={user}
            className={twMerge(
              'flex items-center justify-between px-2 py-1 text-sm',
              index < advancementCount && 'rounded-sm bg-primary/10'
            )}>
            <div className='flex items-center gap-1'>
              <span className='w-4 font-kh-interface text-muted-foreground tabular-nums'>
                {index + 1}.
              </span>
              <span className='truncate font-f1'>
                {users?.find(u => u.id === user)?.shortName ??
                  loc.no.match.unknownUser}
              </span>
            </div>

            <div className='flex items-center gap-4'>
              <div className='w-8 text-end font-kh-interface text-muted-foreground tabular-nums'>
                {seed.toFixed()}
              </div>

              <span className='w-4 text-end font-kh-interface text-primary tabular-nums'>
                {wins}
              </span>
              <span className='w-4 text-end font-kh-interface text-muted-foreground tabular-nums'>
                {losses}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
