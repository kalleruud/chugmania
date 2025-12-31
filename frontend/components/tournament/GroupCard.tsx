import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GroupWithPlayers } from '@common/models/tournament'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { NameCellPart } from '../timeentries/TimeEntryRow'

type GroupCardProps = {
  group: GroupWithPlayers
  className?: string
} & ComponentProps<'div'>

export default function GroupCard({
  group,
  className,
  ...props
}: Readonly<GroupCardProps>) {
  const sortedPlayers = [...group.players].sort((a, b) => a.seed - b.seed)

  return (
    <Card className={twMerge('w-full', className)} {...props}>
      <CardHeader>
        <CardTitle>{group.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex flex-col gap-2'>
          {sortedPlayers.map(player => (
            <div
              key={player.id}
              className='hover:bg-foreground/5 flex items-center justify-between rounded-sm p-2'>
              <div className='flex items-center gap-2'>
                <span className='text-muted-foreground font-kh-interface text-sm font-bold'>
                  #{player.seed}
                </span>
                <NameCellPart
                  name={
                    player.user.shortName ??
                    player.user.lastName ??
                    player.user.firstName ??
                    'Unknown'
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
