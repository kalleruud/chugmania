import { tryCatchAsync } from '@common/utils/try-catch'
import { isRecord } from '@common/utils/utils'

export async function fetchNextMapId(uid: string): Promise<string | null> {
  const { data: response, error } = await tryCatchAsync(
    fetch(`https://trackmania.io/api/map/${encodeURIComponent(uid)}`, {
      headers: { 'User-Agent': 'chugmania' },
    })
  )
  if (error || !response.ok) return null

  const { data: map } = await tryCatchAsync<unknown>(response.json())
  return isRecord(map) && typeof map.mapId === 'string' ? map.mapId : null
}
