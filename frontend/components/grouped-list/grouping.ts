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
