import loc from '@common/locale/locales'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { PageSubheader } from '../PageHeader'
import type { BaseRowProps } from '../row/RowProps'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import { groupItems, limitGroups, type Group, type Grouping } from './grouping'

type GroupedListProps<T> = {
  items: T[]
  Row: ComponentType<BaseRowProps<T>>
  getKey: (item: T) => string
  grouping?: Grouping<T>
  groupLimit?: number
  totalLimit?: number
  rowProps?: (item: T) => Partial<BaseRowProps<T>>
}

const UNGROUPED_KEY = ''

function toGroups<T>(items: T[], grouping?: Grouping<T>): Group<T>[] {
  if (grouping) return groupItems(items, grouping)
  return [{ key: UNGROUPED_KEY, label: '', items }]
}

function LimitButtons({
  onShowMore,
  onShowLess,
}: Readonly<{ onShowMore?: () => void; onShowLess?: () => void }>) {
  if (!onShowMore && !onShowLess) return undefined

  return (
    <div className='flex gap-2'>
      {onShowMore && (
        <Button
          variant='ghost'
          size='sm'
          className='w-fit text-muted-foreground'
          onClick={onShowMore}>
          <ChevronDown />
          {loc.no.common.showMore}
        </Button>
      )}
      {onShowLess && (
        <Button
          variant='ghost'
          size='sm'
          className='w-fit text-muted-foreground'
          onClick={onShowLess}>
          <ChevronUp />
          {loc.no.common.showLess}
        </Button>
      )}
    </div>
  )
}

export default function GroupedList<T>({
  items,
  Row,
  getKey,
  grouping,
  groupLimit,
  totalLimit,
  rowProps,
}: Readonly<GroupedListProps<T>>) {
  const [groupCounts, setGroupCounts] = useState<
    Partial<Record<string, number>>
  >({})
  const [totalCount, setTotalCount] = useState(totalLimit)

  if (items.length === 0) {
    return (
      <Empty className='border border-input text-sm text-muted-foreground'>
        {loc.no.common.noItems}
      </Empty>
    )
  }

  const setGroupCount = (key: string, count: number | undefined) =>
    setGroupCounts(counts => ({ ...counts, [key]: count }))

  const { visibleGroups, canShowMore: canShowMoreTotal } = limitGroups(
    toGroups(items, grouping),
    { groupCounts, groupLimit, totalCount }
  )
  const canShowLessTotal =
    totalLimit !== undefined &&
    totalCount !== undefined &&
    totalCount > totalLimit

  return (
    <div className='flex flex-col gap-2'>
      {visibleGroups.map(({ group, limit, shown, canShowMore }) => {
        return (
          <section key={group.key} className='flex flex-col gap-2'>
            {grouping && (
              <PageSubheader
                className='sticky top-0 z-10 bg-black'
                title={group.label}
                description={group.items.length.toString()}
              />
            )}
            {group.items.slice(0, shown).map(item => (
              <Row key={getKey(item)} item={item} {...rowProps?.(item)} />
            ))}
            <LimitButtons
              onShowMore={
                groupLimit !== undefined && canShowMore
                  ? () => setGroupCount(group.key, limit + groupLimit)
                  : undefined
              }
              onShowLess={
                groupLimit !== undefined && limit > groupLimit
                  ? () => setGroupCount(group.key, undefined)
                  : undefined
              }
            />
          </section>
        )
      })}
      {totalLimit !== undefined && (
        <LimitButtons
          onShowMore={
            canShowMoreTotal
              ? () => setTotalCount(count => (count ?? 0) + totalLimit)
              : undefined
          }
          onShowLess={
            canShowLessTotal ? () => setTotalCount(totalLimit) : undefined
          }
        />
      )}
    </div>
  )
}
