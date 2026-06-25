export function getRandomItem<T>(list?: T[]): T | null {
  if (!list || list.length === 0) return null
  const randomIndex = Math.floor(Math.random() * list.length)
  return list[randomIndex]
}
