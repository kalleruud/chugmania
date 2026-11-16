import loc from '@common/locale/locales'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageSubheader } from '../PageHeader'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import { groupItems, limitGroups, type Group, type Grouping } from './grouping'

type GroupedListProps<T, P> = {
  items: T[]
  Row: ComponentType<P>
  rowProps: (item: T) => P
  getKey: (item: T) => string
  grouping?: Grouping<T>
  groupLimit?: number
  totalLimit?: number
  itemsClassName?: string
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

export default function GroupedList<T, P extends object>({
  items,
  Row,
  rowProps,
  getKey,
  grouping,
  groupLimit,
  totalLimit,
  itemsClassName,
}: Readonly<GroupedListProps<T, P>>) {
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
      {visibleGroups.map(
        ({ group, limit, shown, canShowMore, canShowLess }) => {
          return (
            <section key={group.key} className='flex flex-col gap-2'>
              {grouping && (
                <PageSubheader
                  className='sticky top-0 z-10 bg-background'
                  title={group.label}
                  image={group.icon}
                  description={group.description}
                />
              )}
              <div className={twMerge('flex flex-col gap-2', itemsClassName)}>
                {group.items.slice(0, shown).map(item => (
                  <Row key={getKey(item)} {...rowProps(item)} />
                ))}
              </div>
              <LimitButtons
                onShowMore={
                  groupLimit !== undefined && canShowMore
                    ? () => setGroupCount(group.key, limit + groupLimit)
                    : undefined
                }
                onShowLess={
                  canShowLess
                    ? () => setGroupCount(group.key, undefined)
                    : undefined
                }
              />
            </section>
          )
        }
      )}
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
