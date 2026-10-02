import { useData } from '@/contexts/DataContext'
import type { TournamentDetails } from '@common/models/tournament'
import UserRow from '../user/UserRow'

export default function TournamentGroupPanel({
  group,
}: Readonly<{ group: TournamentDetails['groups'][number] }>) {
  const { users } = useData()

  const players = group.standings.map(s => ({
    ...s,
    user: users?.find(u => u.id === s.user),
  }))

  return (
    <section className='min-w-0 overflow-hidden rounded-sm border border-border bg-background'>
      <header className='flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background-secondary px-4 py-3'>
        <div className='min-w-0 pb-1'>
          <h3 className='truncate'>{group.name}</h3>
        </div>
      </header>

      <div className='p-2'>
        {players.map(p =>
          p.user === undefined ? null : (
            <UserRow
              className='px-2 py-3'
              item={p.user}
              highlight={p.qualifies}
              rank={p.rank}
            />
          )
        )}
      </div>
    </section>
  )
}
