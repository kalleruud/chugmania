import loc from '@common/locale/locales'
import type { SessionWithSignups } from '@common/models/session'
import { DateTime } from 'luxon'
import SessionsList from './SessionsList'

export default function SessionsArchive({
  sessions,
}: Readonly<{ sessions: SessionWithSignups[] }>) {
  const sessionsByYear = new Map<number, SessionWithSignups[]>()

  for (const session of sessions.toSorted(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )) {
    const year = DateTime.fromJSDate(new Date(session.date), {
      zone: 'Europe/Oslo',
    }).year
    const yearSessions = sessionsByYear.get(year) ?? []
    yearSessions.push(session)
    sessionsByYear.set(year, yearSessions)
  }

  if (sessionsByYear.size === 0) {
    return (
      <SessionsList header={loc.no.session.past} sessions={[]} hideCreate />
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      {[...sessionsByYear.entries()]
        .toSorted(([a], [b]) => b - a)
        .map(([year, yearSessions]) => (
          <SessionsList
            key={year}
            header={`${loc.no.session.past} ${year}`}
            sessions={yearSessions}
            hideCreate
          />
        ))}
    </div>
  )
}
