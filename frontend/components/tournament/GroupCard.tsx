import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
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
        'bg-background flex flex-col gap-2 rounded-lg border p-4',
        className
      )}
      {...props}>
      <h5 className='font-f1-bold uppercase'>{group.name}</h5>

      <div className='flex flex-col gap-1'>
        <div className='text-muted-foreground flex items-center justify-between gap-2 px-2 text-sm'>
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
              index < advancementCount && 'bg-primary/10 rounded-sm'
            )}>
            <div className='flex items-center gap-1'>
              <span className='text-muted-foreground font-kh-interface w-4 tabular-nums'>
                {index + 1}.
              </span>
              <span className='font-f1 truncate'>
                {users?.find(u => u.id === user)?.shortName ??
                  loc.no.match.unknownUser}
              </span>
            </div>

            <div className='flex items-center gap-4'>
              <div className='text-muted-foreground font-kh-interface w-8 text-end tabular-nums'>
                {seed.toFixed()}
              </div>

              <span className='text-primary font-kh-interface w-4 text-end tabular-nums'>
                {wins}
              </span>
              <span className='text-muted-foreground font-kh-interface w-4 text-end tabular-nums'>
                {losses}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
