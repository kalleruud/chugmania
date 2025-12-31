import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GroupWithPlayers } from '@common/models/tournament'
import { UserIcon } from '@heroicons/react/24/solid'

type GroupCardProps = {
  group: GroupWithPlayers
}

export default function GroupCard({ group }: Readonly<GroupCardProps>) {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>{group.name}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {group.players.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No players</p>
        ) : (
          group.players.map(player => (
            <div
              key={player.id}
              className='flex items-center gap-2 rounded-md p-2'>
              <div className='bg-background-secondary flex h-8 w-8 items-center justify-center rounded-full border'>
                <UserIcon className='text-muted-foreground size-4' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium'>
                  {player.user.firstName} {player.user.lastName}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Seed #{player.seed}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
