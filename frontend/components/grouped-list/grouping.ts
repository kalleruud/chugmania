export type Grouping<T> = {
  key: (item: T) => string
  label: (key: string) => string
}

export type Group<T> = {
  key: string
  label: string
  items: T[]
}

export function groupItems<T>(items: T[], grouping: Grouping<T>): Group<T>[] {
  const groups = new Map<string, Group<T>>()

  for (const item of items) {
    const key = grouping.key(item)
    const group = groups.get(key) ?? {
      key,
      label: grouping.label(key),
      items: [],
    }
    group.items.push(item)
    groups.set(key, group)
  }

  return [...groups.values()]
}

export type VisibleGroup<T> = {
  group: Group<T>
  limit: number
  shown: number
  canShowMore: boolean
}

type GroupLimits = {
  groupCounts: Partial<Record<string, number>>
  groupLimit?: number
  totalCount?: number
}

export function limitGroups<T>(
  groups: Group<T>[],
  { groupCounts, groupLimit, totalCount }: GroupLimits
): { visibleGroups: VisibleGroup<T>[]; canShowMore: boolean } {
  let budget = totalCount ?? Number.POSITIVE_INFINITY
  let hidden = 0
  const visibleGroups: VisibleGroup<T>[] = []

  for (const group of groups) {
    const limit = groupCounts[group.key] ?? groupLimit ?? group.items.length
    const shown = Math.min(limit, group.items.length, budget)
    budget -= shown
    hidden += group.items.length - shown
    if (shown > 0) {
      visibleGroups.push({
        group,
        limit,
        shown,
        canShowMore: budget > 0 && shown < group.items.length,
      })
    }
  }

  return { visibleGroups, canShowMore: budget <= 0 && hidden > 0 }
}
