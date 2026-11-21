import { PageSubheader } from '@/components/PageHeader'
import { Empty } from '@/components/ui/empty'
import UserRow from '@/components/user/UserRow'
import loc from '@common/locale/locales'
import type { UserInfo } from '@common/models/user'
import type { ReactNode } from 'react'

type SessionUserGroupItem = {
  key: string
  user: UserInfo
  highlight?: boolean
  actions?: ReactNode
}

export default function SessionUserGroup({
  title,
  items,
}: Readonly<{ title: string; items: SessionUserGroupItem[] }>) {
  return (
    <div className='flex flex-col'>
      <PageSubheader title={title} description={items.length.toString()} />
      {items.length === 0 ? (
        <Empty className='border border-input text-sm text-muted-foreground'>
          {loc.no.common.noItems}
        </Empty>
      ) : (
        <div className='rounded-sm bg-background-secondary'>
          {items.map(({ key, user, highlight, actions }) => (
            <UserRow
              key={key}
              item={user}
              className='min-h-12 w-full py-1'
              highlight={highlight}
              hideRanking>
              {actions}
            </UserRow>
          ))}
        </div>
      )}
    </div>
  )
}
