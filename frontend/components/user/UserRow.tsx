import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { useData } from '@/contexts/DataContext'
import { type UserInfo } from '@common/models/user'
import { ChevronRight, Minus } from 'lucide-react'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { Spinner } from '../ui/spinner'

type UserRowProps = BaseRowProps<UserInfo> & {
  hideRanking?: boolean
  rank?: number
}

export default function UserRow({
  item: user,
  className,
  hideLink,
  highlight,
  hideRanking,
  children,
  rank,
  ...props
}: Readonly<UserRowProps>) {
  const { rankings, isLoadingData } = useData()

  if (isLoadingData) {
    return <Spinner className='size-4' />
  }

  const ranking =
    rank === undefined ? rankings.find(r => r.user === user.id)?.ranking : rank

  const showRanking = !hideRanking && ranking
  const showMissingRanking = !hideRanking && !ranking

  const content = (
    <>
      <ItemContent className='relative z-10'>
        <div className='flex items-center gap-2'>
          {showRanking && (
            <p
              className={twMerge(
                'font-kh-interface text-lg font-black text-primary tabular-nums',
                highlight && 'group-hover:text-primary-foreground'
              )}>
              {ranking}
            </p>
          )}

          {showMissingRanking && (
            <Minus className='size-4 text-muted-foreground' />
          )}

          {hideRanking && !showRanking && !showMissingRanking && (
            <div className='h-4 w-1 rounded-full bg-primary' />
          )}

          <ItemTitle className='mr-auto flex gap-1 font-f1 uppercase'>
            <span>{user.firstName}</span>
            <span className='font-bold'>{user.lastName}</span>
          </ItemTitle>

          {children && (
            <div className='pointer-events-auto relative z-10'>{children}</div>
          )}
        </div>
      </ItemContent>
      {!hideLink && (
        <ItemActions
          className={twMerge(
            'relative z-10',
            highlight && 'text-primary group-hover:text-primary-foreground'
          )}>
          <ChevronRight className='size-4' />
        </ItemActions>
      )}
    </>
  )

  if (hideLink) {
    return (
      <Item
        key={user.id}
        className={twMerge('group', highlight && 'bg-foreground/3', className)}
        asChild
        {...props}>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item
      key={user.id}
      className={twMerge(
        'group relative',
        highlight && 'bg-primary-background hover:bg-primary',
        !highlight && 'hover:bg-accent/50',
        className
      )}
      {...props}>
      <div className='pointer-events-none contents'>{content}</div>
      <Link
        className='absolute inset-0 z-0 rounded-sm transition-colors duration-100'
        to={`/users/${user.id}`}
        aria-label={`${user.firstName} ${user.lastName}`}
      />
    </Item>
  )
}
