import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { TournamentDetails } from '@common/models/tournament'
import { getUserFullName } from '@common/models/user'
import { Flag, Users } from 'lucide-react'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { Badge } from '../ui/badge'

export default function TournamentGroupPanel({
  group,
}: Readonly<{ group: TournamentDetails['groups'][number] }>) {
  const { users } = useData()
  const advancing = group.standings.filter(row => row.qualifies).length

  return (
    <section className='min-w-0 overflow-hidden rounded-sm border border-border bg-background'>
      <header className='flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background-secondary px-4 py-3'>
        <div className='min-w-0'>
          <p className='font-f1 text-xs text-muted-foreground uppercase'>
            Gruppe
          </p>
          <h3 className='truncate'>{group.name}</h3>
        </div>
        <Badge variant='outline' className='text-muted-foreground'>
          <Users aria-hidden='true' />
          {group.standings.length} spillere
        </Badge>
      </header>
      <table className='w-full table-fixed text-sm'>
        <caption className='sr-only'>Gruppe {group.name}: stilling</caption>
        <thead className='border-b border-border font-f1 text-xs text-muted-foreground uppercase'>
          <tr>
            <th scope='col' className='w-12 py-3 text-center'>
              <span className='sr-only'>Plass</span>#
            </th>
            <th scope='col' className='py-3 text-left'>
              Spiller
            </th>
            <th
              scope='col'
              className='w-12 py-3 text-center'
              aria-label='Seire'>
              V
            </th>
            <th
              scope='col'
              className='w-12 py-3 pr-2 text-center'
              aria-label='Tap'>
              T
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border'>
          {group.standings.map(row => {
            const user = users?.find(user => user.id === row.user)
            const name =
              user?.shortName ??
              (user ? getUserFullName(user) : loc.no.match.unknownUser)
            return (
              <tr
                key={row.user}
                className={row.qualifies ? 'bg-primary/5' : undefined}>
                <td
                  className={`border-l-2 py-3 text-center font-kh-interface text-xl tabular-nums ${row.qualifies ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
                  {row.rank}
                </td>
                <th scope='row' className='py-3 pr-2 text-left font-normal'>
                  <NameCellPart name={name} className='text-xs' />
                  {row.qualifies && (
                    <span className='sr-only'>Videreplass</span>
                  )}
                </th>
                <td className='py-3 text-center font-kh-interface text-lg tabular-nums'>
                  {row.wins}
                </td>
                <td className='py-3 pr-2 text-center font-kh-interface text-lg text-muted-foreground tabular-nums'>
                  {row.losses}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <footer className='flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground'>
        <Flag className='size-3 text-primary' aria-hidden='true' />
        {advancing} videreplasser
      </footer>
    </section>
  )
}
