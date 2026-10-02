import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { TournamentDetails } from '@common/models/tournament'
import { Lock } from 'lucide-react'
import MatchList from '../match/MatchList'
import { TimeEntryList } from '../timeentries/TimeEntryList'
import { TrackRow } from '../track/TrackRow'
import UserRow from '../user/UserRow'
import TournamentGroupPanel from './TournamentGroupPanel'

export default function TournamentPanel({
  details,
  isPreview = false,
}: {
  details: TournamentDetails
  isPreview?: boolean
}) {
  const { users, tracks } = useData()
  const workload = details.workloadSummary
  const qualiTrack = tracks?.find(
    t => t.id === details.config.qualificationTrack
  )

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

      <section className='flex flex-col gap-2 rounded-sm border bg-background p-2'>
        <h3 className='flex items-center gap-2 px-4 pt-4'>
          {loc.no.tournament.qualification}
          {details.frozen && (
            <Lock aria-label={loc.no.tournament.frozen} size={16} />
          )}
        </h3>

        {qualiTrack && <TrackRow item={qualiTrack} />}

        <TimeEntryList
          entries={details.qualificationEntries}
          track={details.config.qualificationTrack}
          session={details.config.session}
          filter='all'
        />
      </section>

      <div className='grid gap-4 sm:grid-cols-2'>
        {details.groups.map(group => (
          <TournamentGroupPanel key={group.id} group={group} />
        ))}
      </div>

      <section className='flex flex-col gap-2 rounded-sm border bg-background p-2'>
        <h3 className='p-4'>{loc.no.match.title}</h3>
        <MatchList matches={details.matches} managed readOnly={isPreview} />
      </section>

      <section className='flex flex-col gap-2 rounded-sm border bg-background p-2'>
        <h3 className='p-4'>
          {details.completed
            ? loc.no.tournament.finalStandings
            : loc.no.tournament.provisional}
        </h3>
        {details.standings.map(row => {
          const user = users?.find(u => u.id === row.user)
          if (!user) return null
          return <UserRow item={user} />
        })}
      </section>
    </div>
  )
}
