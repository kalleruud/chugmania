import { useData } from '@/contexts/DataContext'
import { useTimeEntryInput } from '@/contexts/TimeEntryInputContext'
import loc from '@common/locale/locales'
import type { GapType } from '@common/models/timeEntry'
import type { TournamentDetails } from '@common/models/tournament'
import { useState } from 'react'
import MatchList from '../match/MatchList'
import TimeEntryRow from '../timeentries/TimeEntryRow'
import { Button } from '../ui/button'

export default function TournamentPanel({
  details,
  isPreview = false,
}: {
  details: TournamentDetails
  isPreview?: boolean
}) {
  const { users, timeEntries } = useData()
  const { open } = useTimeEntryInput()
  const [gapType, setGapType] = useState<GapType>('leader')
  const name = (id: string) => users?.find(u => u.id === id)?.firstName ?? id
  const workload = details.workloadSummary
  return (
    <div className='flex min-w-0 flex-col gap-6'>
      <header>
        {isPreview ? (
          <p>
            {workload.tracks} baner · {workload.qualificationLaps}{' '}
            kvalifiseringsrunde per spiller · {workload.minMatches}–
            {workload.maxMatches} matcher per spiller
          </p>
        ) : (
          <>
            <h2>{details.config.name}</h2>
            <p>{details.config.description}</p>
          </>
        )}
        <p>
          {details.progress.decided} / {details.progress.total} matcher ·{' '}
          {details.progress.groupDecided} / {details.progress.groupTotal}{' '}
          gruppematcher
        </p>
        {details.notReadyReason && (
          <p role='status' className='text-destructive'>
            {details.notReadyReason}
          </p>
        )}
        {details.cancelled && <p role='status'>{loc.no.tournament.session}</p>}
      </header>
      <section>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <h3>
            {loc.no.tournament.qualification}{' '}
            {details.frozen && `· ${loc.no.tournament.frozen}`}
          </h3>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() =>
              setGapType(gapType === 'leader' ? 'interval' : 'leader')
            }>
            {gapType === 'leader'
              ? loc.no.timeEntry.gap.leader
              : loc.no.timeEntry.gap.interval}
          </Button>
        </div>
        {details.qualification.map(p => (
          <TimeEntryRow
            key={p.user}
            item={{ user: p.user, duration: p.duration, comment: null }}
            pending={p.duration === null}
            onClick={
              isPreview
                ? undefined
                : () =>
                    open(
                      timeEntries?.find(
                        entry => entry.id === p.sourceEntry
                      ) ?? {
                        user: p.user,
                        session: details.config.session,
                        track: details.config.qualificationTrack,
                      }
                    )
            }
            position={p.rank}
            gap={{
              position: p.rank,
              leader: p.gapLeader ?? undefined,
              previous: p.gapPrevious ?? undefined,
            }}
            gapType={gapType}
            onChangeGapType={() =>
              setGapType(gapType === 'leader' ? 'interval' : 'leader')
            }
            className='p-2'
          />
        ))}
      </section>
      <div className='grid gap-4 xl:grid-cols-2'>
        {details.groups.map(group => (
          <section key={group.id} className='rounded border p-3'>
            <h3>Gruppe {group.name}</h3>
            <table className='w-full'>
              <thead>
                <tr>
                  <th className='text-left'>Spiller</th>
                  <th>V</th>
                  <th>T</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map(row => (
                  <tr
                    key={row.user}
                    className={row.qualifies ? 'text-primary' : undefined}>
                    <td>
                      {row.rank}. {name(row.user)}
                    </td>
                    <td className='text-center'>{row.wins}</td>
                    <td className='text-center'>{row.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <MatchList matches={details.matches} managed readOnly={isPreview} />
      <section>
        <h3>
          {details.completed
            ? loc.no.tournament.finalStandings
            : loc.no.tournament.provisional}
        </h3>
        {details.standings.map(row => (
          <p key={row.user}>
            {row.rank}. {name(row.user)}
          </p>
        ))}
      </section>
    </div>
  )
}
