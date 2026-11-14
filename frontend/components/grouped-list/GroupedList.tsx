import loc from '@common/locale/locales'
import { ChevronDown } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { PageSubheader } from '../PageHeader'
import type { BaseRowProps } from '../row/RowProps'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import { groupItems, type Group, type Grouping } from './grouping'

type GroupedListProps<T> = {
  items: T[]
  Row: ComponentType<BaseRowProps<T>>
  getKey: (item: T) => string
  grouping?: Grouping<T>
  pageSize?: number
  rowProps?: (item: T) => Partial<BaseRowProps<T>>
  empty?: ReactNode
}

const UNGROUPED_KEY = ''

function toGroups<T>(items: T[], grouping?: Grouping<T>): Group<T>[] {
  if (grouping) return groupItems(items, grouping)
  return [{ key: UNGROUPED_KEY, label: '', items }]
}

export default function GroupedList<T>({
  items,
  Row,
  getKey,
  grouping,
  pageSize,
  rowProps,
  empty,
}: Readonly<GroupedListProps<T>>) {
  const [visibleCounts, setVisibleCounts] = useState<
    Partial<Record<string, number>>
  >({})

  if (items.length === 0) {
    return (
      <Empty className='border border-input text-sm text-muted-foreground'>
        {empty ?? loc.no.common.noItems}
      </Empty>
    )
  }

  const showMore = (key: string, current: number) =>
    setVisibleCounts(counts => ({
      ...counts,
      [key]: current + (pageSize ?? 0),
    }))

  return (
    <div className='flex flex-col gap-2'>
      {toGroups(items, grouping).map(group => {
        const visibleCount =
          visibleCounts[group.key] ?? pageSize ?? group.items.length
        const remaining = group.items.length - visibleCount

        return (
          <section key={group.key} className='flex flex-col gap-2'>
            {grouping && (
              <PageSubheader
                title={group.label}
                description={group.items.length.toString()}
              />
            )}
            {group.items.slice(0, visibleCount).map(item => (
              <Row key={getKey(item)} item={item} {...rowProps?.(item)} />
            ))}
            {remaining > 0 && (
              <Button
                variant='ghost'
                size='sm'
                className='w-fit text-muted-foreground'
                onClick={() => showMore(group.key, visibleCount)}>
                <ChevronDown />
                {loc.no.common.showMore(remaining)}
              </Button>
            )}
          </section>
        )
      })}
    </div>
  )
}
