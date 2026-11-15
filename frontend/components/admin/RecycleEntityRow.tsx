import MatchRow from '@/components/match/MatchRow'
import { SessionRow } from '@/components/session/SessionRow'
import TimeEntryRow from '@/components/timeentries/TimeEntryRow'
import { TrackRow } from '@/components/track/TrackRow'
import UserRow from '@/components/user/UserRow'
import loc from '@common/locale/locales'
import type { RecycleItem } from '@common/models/recycleBin'
import type { UserInfo } from '@common/models/user'

export default function RecycleEntityRow({
  item,
  deletedUsers,
}: Readonly<{ item: RecycleItem; deletedUsers: UserInfo[] }>) {
  switch (item.table) {
    case 'users':
      return <UserRow item={item.record} hideLink hideRanking />
    case 'tracks':
      return <TrackRow item={item.record} hideLink />
    case 'sessions':
      return <SessionRow item={item.record} hideLink />
    case 'timeEntries':
      return (
        <TimeEntryRow
          item={item.record}
          user={deletedUsers.find(user => user.id === item.record.user)}
          onChangeGapType={() => {}}
        />
      )
    case 'matches':
      return (
        <MatchRow
          item={item.record}
          user1={deletedUsers.find(user => user.id === item.record.user1)}
          user2={deletedUsers.find(user => user.id === item.record.user2)}
          readOnly
        />
      )
    default:
      return (
        <div className='p-2'>
          <span className='font-bold'>{loc.no.admin.tables[item.table]}</span>
          <p className='text-sm break-all text-muted-foreground'>
            {item.record.label}
          </p>
        </div>
      )
  }
}
