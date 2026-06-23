import MatchRow from '@/components/match/MatchRow'
import { PageSubheader } from '@/components/PageHeader'
import TimeEntryRow, {
  type GapType,
} from '@/components/timeentries/TimeEntryRow'
import { Empty } from '@/components/ui/empty'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import loc from '@/lib/locales'
import type { LeaderboardEntryGap, TimeEntry } from '@common/models/timeEntry'
import type { TournamentDetails } from '@common/models/tournament'
import type { ComponentProps } from 'react'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

function getGap(
  i: number,
  entry: TimeEntry,
  compareEntry: TimeEntry | undefined,
  leader: TimeEntry | undefined = undefined
): LeaderboardEntryGap | undefined {
  if (!entry.duration) return undefined
  if (leader) {
    return {
      position: i,
      leader: leader.duration ? entry.duration - leader.duration : undefined,
      previous: undefined,
    }
  }
  return {
    position: i,
    previous: compareEntry
      ? entry.duration - (compareEntry.duration ?? 0)
      : undefined,
  }
}

export default function TournamentPanel({
  details,
  className,
  ...rest
}: Readonly<{ details: TournamentDetails } & ComponentProps<'div'>>) {
  const [gapType, setGapType] = useState<GapType>('interval')
  const timedEntries = useMemo(() => {
    const out: TimeEntry[] = []
    for (const q of details.qualification) {
      if (!q.pending && q.timeEntry?.duration) {
        out.push(q.timeEntry)
      }
    }
    return out
  }, [details.qualification])

  return (
    <div className={twMerge('flex flex-col gap-6', className)} {...rest}>
      <div>
        {details.isPreview ? (
          <div className='flex flex-col gap-2'>
            <p className='text-sm'>
              {loc.no.tournament.previewWorkload.distinctTracks(
                details.workloadSummary.distinctTrackCount
              )}
            </p>
            <p className='text-sm'>
              {loc.no.tournament.previewWorkload.qualificationLaps}
            </p>
            <p className='text-sm'>
              {loc.no.tournament.previewWorkload.tournamentMatchesRange(
                details.workloadSummary.tournamentMatchesPerPlayer.min,
                details.workloadSummary.tournamentMatchesPerPlayer.max
              )}
            </p>
            <p className='text-muted-foreground mt-1 text-sm'>
              {loc.no.tournament.progress(
                details.progress.completedTournamentMatches,
                details.progress.totalTournamentMatches
              )}
            </p>
            <p className='text-muted-foreground text-sm'>
              {loc.no.tournament.progressGroups(
                details.progress.groupMatchesCompleted,
                details.progress.groupMatchesTotal
              )}
            </p>
          </div>
        ) : (
          <>
            <h2 className='text-xl font-semibold tracking-wide'>
              {details.name}
            </h2>
            {details.description && (
              <p className='text-muted-foreground mt-1 text-sm'>
                {details.description}
              </p>
            )}
            <p className='text-muted-foreground mt-2 text-sm'>
              {loc.no.tournament.progress(
                details.progress.completedTournamentMatches,
                details.progress.totalTournamentMatches
              )}
            </p>
            <p className='text-muted-foreground text-sm'>
              {loc.no.tournament.progressGroups(
                details.progress.groupMatchesCompleted,
                details.progress.groupMatchesTotal
              )}
            </p>
          </>
        )}
      </div>

      <section>
        <PageSubheader title={loc.no.tournament.qualificationTitle} />
        <div className='flex justify-end py-2'>
          <ToggleGroup
            type='single'
            value={gapType}
            onValueChange={v => setGapType(v as GapType)}
            variant='outline'
            size='sm'>
            <ToggleGroupItem value='leader'>
              {loc.no.timeEntry.gap.leader}
            </ToggleGroupItem>
            <ToggleGroupItem value='interval'>
              {loc.no.timeEntry.gap.interval}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className='bg-background-secondary flex flex-col rounded-sm'>
          {details.qualification.map(q => {
            const entry =
              q.timeEntry ??
              ({
                id: `qual-pending-${q.userId}`,
                user: q.userId,
                track: details.qualificationTrackId,
                session: details.sessionId,
                duration: null,
                amount: 0.5,
                comment: null,
                createdAt: new Date(),
                updatedAt: null,
                deletedAt: null,
              } as TimeEntry)
            let gap: LeaderboardEntryGap | undefined
            if (!q.pending && q.timeEntry?.duration) {
              const i = timedEntries.findIndex(e => e.id === q.timeEntry!.id)
              gap = getGap(
                i + 1,
                q.timeEntry,
                gapType === 'interval' ? timedEntries.at(i - 1) : undefined,
                gapType === 'leader' ? timedEntries.at(0) : undefined
              )
            }
            return (
              <TimeEntryRow
                key={q.userId}
                item={entry}
                qualificationPending={q.pending}
                gap={gap}
                gapType={gapType}
                onChangeGapType={() =>
                  setGapType(gapType === 'leader' ? 'interval' : 'leader')
                }
                highlight={false}
                className='px-4 py-3'
              />
            )
          })}
        </div>
      </section>

      <section>
        <PageSubheader
          title={loc.no.tournament.title}
          description={loc.no.match.stage.group}
        />
        <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
          {details.groups.map(g => (
            <div
              key={g.id}
              className='bg-background-secondary border-border rounded-sm border p-3'>
              <h4 className='font-kh-interface mb-2 text-sm uppercase'>
                {loc.no.match.stage.group} {g.name}
              </h4>
              <div className='flex flex-col gap-1 text-sm'>
                {g.standings.map(s => (
                  <div
                    key={s.userId}
                    className='flex justify-between gap-2 border-b border-white/5 py-1 last:border-0'>
                    <span>
                      {s.rank}. {s.user.shortName ?? s.user.firstName}
                    </span>
                    <span className='text-muted-foreground'>
                      {s.wins}–{s.losses}
                      {s.qualifies && (
                        <span className='text-primary ml-2'>✓</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <PageSubheader title={loc.no.match.title} />
        {details.matches.length === 0 ? (
          <Empty className='border-input text-muted-foreground border text-sm'>
            {loc.no.common.noItems}
          </Empty>
        ) : (
          <div className='bg-background-secondary flex flex-col rounded-sm'>
            {details.matches.map(tm => (
              <MatchRow
                key={tm.tournamentMatchId}
                item={tm.match!}
                readOnly={tm.readOnly}
                slotLabel1={tm.slot1Label}
                slotLabel2={tm.slot2Label}
                hideTrack={false}
                className='border-border border-b last:border-0'
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
