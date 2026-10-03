import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { Match } from '@common/models/match'
import type { TournamentDetails } from '@common/models/tournament'
import { firstPendingMatch, stageName } from '@common/utils/tournament'
import { ChevronDown, Lock } from 'lucide-react'
import MatchList from '../match/MatchList'
import SegmentedProgress from '../SegmentedProgress'
import { TimeEntryList } from '../timeentries/TimeEntryList'
import { TrackRow } from '../track/TrackRow'
import UserRow from '../user/UserRow'
import DeleteTournamentDialog from './DeleteTournamentDialog'
import TournamentGroupPanel from './TournamentGroupPanel'

export default function TournamentPanel({
  details,
  isPreview = false,
}: {
  details: TournamentDetails
  isPreview?: boolean
}) {
  const { users, tracks } = useData()
  const { isLoggedIn, loggedInUser } = useAuth()
  const canEdit = isLoggedIn && loggedInUser.role !== 'user'
  const workload = details.workloadSummary
  const qualiTrack = tracks?.find(
    t => t.id === details.config.qualificationTrack
  )
  const matchesByStage = new Map<Match['stage'], Match[]>()
  const featuredMatch = firstPendingMatch(details.matches)
  const allMatchesPlayed =
    details.progress.total > 0 &&
    details.progress.decided === details.progress.total
  for (const match of details.matches) {
    const stageMatches = matchesByStage.get(match.stage) ?? []
    stageMatches.push(match)
    matchesByStage.set(match.stage, stageMatches)
  }

  return (
    <div className='flex min-w-0 flex-col gap-6'>
      {canEdit && (
        <header className='flex flex-col gap-2 rounded-sm border bg-background p-4'>
          <div className='flex items-center justify-between gap-2'>
            <h3>{loc.no.tournament.adminPanel}</h3>
            {!isPreview && (
              <DeleteTournamentDialog session={details.config.session} />
            )}
          </div>
          <p className='text-sm text-muted-foreground'>
            {details.qualification.length}{' '}
            {loc.no.session.participants.toLowerCase()} ·{' '}
            {details.groups.length} {loc.no.tournament.groups.toLowerCase()} ·{' '}
            {details.frozen
              ? loc.no.tournament.frozen
              : loc.no.tournament.qualificationOpen}
          </p>
          {isPreview && (
            <p>
              {workload.tracks} baner · {workload.qualificationLaps}{' '}
              kvalifiseringsrunde per spiller · {workload.minMatches}–
              {workload.maxMatches} matcher per spiller
            </p>
          )}
          {details.notReadyReason && (
            <p role='status' className='text-destructive'>
              {details.notReadyReason}
            </p>
          )}
          {details.cancelled && (
            <p role='status'>{loc.no.tournament.session}</p>
          )}
        </header>
      )}

      {allMatchesPlayed && (
        <section className='flex flex-col gap-2 rounded-sm border bg-background p-4'>
          <h3 className='p-2'>{loc.no.tournament.finalStandings}</h3>
          {details.standings.map(row => {
            const user = users?.find(u => u.id === row.user)
            if (!user) return null
            return (
              <UserRow
                key={row.user}
                className='p-0'
                item={user}
                rank={row.rank}
              />
            )
          })}
        </section>
      )}

      <section className='flex flex-col gap-1'>
        <div className='grid gap-4 sm:grid-cols-2'>
          {details.groups.map(group => (
            <TournamentGroupPanel key={group.id} group={group} />
          ))}
        </div>
        <div className='flex items-center gap-2 rounded p-2'>
          <div className='size-2 rounded-full bg-primary-background' />
          <p className='w-full text-sm text-muted-foreground'>
            {loc.no.tournament.groupInfo(details.config.advancementCount)}
          </p>
        </div>
      </section>

      <details
        open={
          !details.frozen &&
          details.qualificationEntries.some(entry => entry.draft)
        }
        className='group/quali rounded-sm border bg-background p-2'>
        <summary className='flex cursor-pointer list-none items-center justify-between gap-2 p-4 [&::-webkit-details-marker]:hidden'>
          <div className='flex min-w-0 flex-col gap-1'>
            <h3 className='flex items-center gap-2'>
              {loc.no.tournament.qualification}
              {details.frozen && (
                <Lock aria-label={loc.no.tournament.frozen} size={16} />
              )}
            </h3>
            <p className='text-sm text-muted-foreground'>
              {loc.no.tournament.qualificationDescription}
            </p>
          </div>
          <ChevronDown
            aria-hidden
            className='size-4 shrink-0 transition-transform group-open/quali:rotate-180'
          />
        </summary>

        <div className='flex flex-col gap-2'>
          {qualiTrack && <TrackRow item={qualiTrack} />}

          <TimeEntryList
            isPreview={isPreview}
            entries={details.qualificationEntries}
            track={details.config.qualificationTrack}
            session={details.config.session}
            filter='all'
          />
        </div>
      </details>

      <details
        open={!allMatchesPlayed}
        className='group/matches rounded-sm border bg-background p-2'>
        <summary className='flex cursor-pointer list-none items-center justify-between gap-2 p-4 [&::-webkit-details-marker]:hidden'>
          <h3>{loc.no.match.title}</h3>
          <ChevronDown
            aria-hidden
            className='size-4 shrink-0 transition-transform group-open/matches:rotate-180'
          />
        </summary>
        <div className='flex flex-col gap-2'>
          <SegmentedProgress
            segments={[
              {
                label: loc.no.tournament.groupMatches,
                value: details.progress.groupDecided,
                total: details.progress.groupTotal,
              },
              {
                label: loc.no.tournament.bracketMatches,
                value: details.progress.decided - details.progress.groupDecided,
                total: details.progress.total - details.progress.groupTotal,
              },
            ]}
          />
          {Array.from(matchesByStage, ([stage, matches]) => {
            const activeMatches = matches.filter(
              match =>
                match.tournament?.reset !== 'conditional' &&
                match.tournament?.reset !== 'unneeded'
            )
            const played = activeMatches.filter(
              match => match.status === 'completed' || match.tournament?.awarded
            ).length
            const isActive = played > 0 && played < activeMatches.length
            return (
              <details
                key={stage ?? 'none'}
                open={!!firstPendingMatch(matches)}
                className='group/stage'>
                <summary className='flex cursor-pointer list-none items-center gap-2 p-2 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden'>
                  <h4 className='mr-auto flex flex-wrap items-center gap-2'>
                    {stageName(stage) || loc.no.match.title}
                  </h4>
                  {isActive && (
                    <div className='size-2 animate-pulse rounded-full bg-primary' />
                  )}
                  <span className='text-xs tabular-nums'>
                    {played}/{activeMatches.length}{' '}
                    {loc.no.match.title.toLowerCase()}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className='size-4 shrink-0 transition-transform group-open/stage:rotate-180'
                  />
                </summary>
                <MatchList
                  matches={matches}
                  managed
                  trackSeparators
                  readOnly={isPreview}
                  featuredMatchId={featuredMatch?.id}
                />
              </details>
            )
          })}
        </div>
      </details>
    </div>
  )
}
