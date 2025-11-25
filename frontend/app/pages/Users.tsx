import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Empty } from '@/components/ui/empty'
import { Item, ItemContent, ItemMedia } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import UserItem from '@/components/user/UserItem'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { Users } from 'lucide-react'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import type { UserInfo } from '../../../common/models/user'
import { PageHeader } from '../components/PageHeader'

type UsersPageProps = DetailedHTMLProps<
  HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>

function UserRowList({ users }: Readonly<{ users: UserInfo[] }>) {
  if (users.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {loc.no.noItems}
      </Empty>
    )
  }
  return (
    <div className='bg-background-secondary rounded-sm'>
      {users.map(user => (
        <UserItem
          key={user.id}
          user={user}
          variant='row'
          className='py-3 first:pt-4 last:pb-4'
        />
      ))}
    </div>
  )
}

export default function UsersPage(props: Readonly<UsersPageProps>) {
  return (
    <div className='p-safe-or-2'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.users.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <UsersList {...props} />
    </div>
  )
}

export function UsersList({ className }: Readonly<UsersPageProps>) {
  const { users: ud } = useData()

  if (ud === undefined) {
    return (
      <div className={twMerge('flex flex-col', className)}>
        <Item>
          <ItemMedia>
            <Skeleton className='size-8 rounded-sm' />
          </ItemMedia>
          <ItemContent>
            <Skeleton className='h-6 w-24 rounded-sm' />
            <Skeleton className='h-4 w-64 rounded-sm' />
          </ItemContent>
        </Item>

        <div className='overflow-clip rounded-sm'>
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
        </div>
      </div>
    )
  }

  const users = Object.values(ud)

  return (
    <div className={twMerge('flex flex-col', className)}>
      <PageHeader
        title={loc.no.users.title}
        description={loc.no.users.description}
        icon={Users}
      />

      <UserRowList users={users} />
    </div>
  )
}
