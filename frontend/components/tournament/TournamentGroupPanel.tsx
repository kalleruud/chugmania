import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { TournamentDetails } from '@common/models/tournament'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import UserRow from '../user/UserRow'

export default function TournamentGroupPanel({
  group,
  href,
}: Readonly<{ group: TournamentDetails['groups'][number]; href?: string }>) {
  const { users } = useData()

  const players = group.standings.map(s => ({
    ...s,
    user: users?.find(u => u.id === s.user),
  }))

  return (
    <section className='min-w-0 overflow-hidden rounded-sm border border-border bg-background'>
      <header className='relative flex items-center justify-between gap-2 border-b border-border bg-background-secondary px-4 py-3'>
        {href && (
          <Link
            to={href}
            aria-label={`${loc.no.tournament.group} ${group.code}: ${group.name}`}
            className='absolute inset-0 rounded-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-primary'
          />
        )}
        <div className='pointer-events-none relative min-w-0 flex-1'>
          <p className='truncate font-f1 text-sm font-bold text-muted-foreground uppercase'>
            {loc.no.tournament.group} {group.code}
          </p>
          <h3 className='truncate'>{group.name}</h3>
        </div>
        {href && (
          <ChevronRight
            aria-hidden
            className='pointer-events-none relative size-4 shrink-0'
          />
        )}
      </header>

      <div className='p-2'>
        {players.map(p =>
          p.user === undefined ? null : (
            <UserRow
              key={p.user.id}
              className='px-3 py-2'
              item={p.user}
              highlight={p.qualifies}
              rank={p.rank}>
              <p className='flex gap-1 font-kh-interface tabular-nums'>
                {p.wins}
                <span className='opacity-33'>|</span>
                {p.losses}
              </p>
            </UserRow>
          )
        )}
      </div>
    </section>
  )
}
