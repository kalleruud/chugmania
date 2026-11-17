import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useTimeEntryInput } from '@/contexts/TimeEntryInputContext'
import loc from '@common/locale/locales'
import type { QueuedEntry } from '@common/models/activeEntry'
import type { SessionWithSignups } from '@common/models/session'
import { Radio } from 'lucide-react'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import MatchCard from '../match/MatchCard'
import MatchRow from '../match/MatchRow'
import { PageHeader } from '../PageHeader'
import TimeEntryCard from '../timeentries/TimeEntryCard'
import TimeEntryRow from '../timeentries/TimeEntryRow'

type ActiveEntryPanelProps = {
  session: SessionWithSignups
  nextCount?: number
} & ComponentProps<'section'>

export default function ActiveEntryPanel({
  className,
  session,
  nextCount = 2,
  ...props
}: Readonly<ActiveEntryPanelProps>) {
  const { activeEntryQueues } = useData()
  const { isLoggedIn, loggedInUser } = useAuth()
  const { open, openMatch } = useTimeEntryInput()
  const queue = activeEntryQueues.get(session.id)
  if (!queue?.now) return null

  const isMe = ({ kind, entry }: QueuedEntry) =>
    isLoggedIn &&
    (kind === 'match'
      ? loggedInUser.id === entry.user1 || loggedInUser.id === entry.user2
      : loggedInUser.id === entry.user)

  const onOpen = (queued: QueuedEntry) => () => {
    if (queued.kind === 'timeEntry') open(queued.entry)
    else if (!queued.entry.tournament?.readOnly) openMatch(queued.entry)
  }

  const next = queue.next.slice(0, nextCount)

  return (
    <section className={twMerge('flex flex-col gap-2', className)} {...props}>
      <PageHeader
        title={loc.no.activeEntry.now}
        description={session.name}
        to={'/sessions/' + session.id}
        Icon={Radio}
        iconClassName='motion-safe:animate-pulse'
      />

      {queue.now.kind === 'match' ? (
        <MatchCard
          compact
          item={queue.now.entry}
          highlight={isMe(queue.now)}
          onClick={onOpen(queue.now)}
        />
      ) : (
        <TimeEntryCard
          compact
          item={queue.now.entry}
          highlight={isMe(queue.now)}
          onClick={onOpen(queue.now)}
        />
      )}

      {next.length > 0 && (
        <div className='flex flex-col gap-2 pt-2'>
          <h3 className='px-2 text-sm text-muted-foreground'>
            {loc.no.activeEntry.next}
          </h3>
          {next.map(queued =>
            queued.kind === 'match' ? (
              <MatchRow
                key={queued.entry.id}
                item={queued.entry}
                highlight={isMe(queued)}
                className='bg-background-secondary hover:bg-primary-foreground/6'
                onClick={onOpen(queued)}
              />
            ) : (
              <TimeEntryRow
                key={queued.entry.id}
                item={queued.entry}
                highlight={isMe(queued)}
                className='bg-background-secondary px-4 py-3'
                onClick={onOpen(queued)}
                onChangeGapType={() => undefined}
                showTrack
              />
            )
          )}
        </div>
      )}
    </section>
  )
}
