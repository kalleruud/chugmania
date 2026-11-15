import { PageSubheader } from '@/components/PageHeader'
import GroupedList from '@/components/grouped-list/GroupedList'
import { byDay } from '@/components/grouped-list/groupings/date'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useConnection } from '@/contexts/ConnectionContext'
import type { RecycleItem } from '@common/models/recycleBin'
import type { UserInfo } from '@common/models/user'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import RecycleEntityRow from './RecycleEntityRow'

import loc from '@common/locale/locales'
import RecycleRow from './RecycleRow'

const grouping = byDay<RecycleItem>(item => item.deletedAt)

export default function RecycleBin() {
  const { socket } = useConnection()
  const [items, setItems] = useState<RecycleItem[]>()
  const [error, setError] = useState<string>()
  const load = useCallback(async () => {
    try {
      const response = await socket.emitWithAck('get_recycle_bin', undefined)
      if (!response.success) throw new Error(response.message)
      setItems(
        response.items.map(item => ({
          ...item,
          deletedAt: new Date(item.deletedAt),
        }))
      )
      setError(undefined)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }, [socket])

  useEffect(() => {
    void Promise.resolve().then(load)
    const refresh = () => {
      void load()
      toast.info(loc.no.admin.recycleBin.updated)
    }
    socket.on('recycle_bin_changed', refresh)
    socket.on('connect', load)
    return () => {
      socket.off('recycle_bin_changed', refresh)
      socket.off('connect', load)
    }
  }, [socket, load])

  const deletedUsers: UserInfo[] =
    items?.flatMap(item => (item.table === 'users' ? [item.record] : [])) ?? []

  return (
    <section className='flex flex-col gap-2'>
      <PageSubheader
        title={loc.no.admin.recycleBin.title}
        description={items?.length.toString()}
      />
      {error && (
        <div role='alert'>
          {error}
          <Button variant='outline' onClick={load}>
            {loc.no.admin.recycleBin.retry}
          </Button>
        </div>
      )}
      {!items && !error && <Spinner />}
      {items && (
        <GroupedList
          items={items}
          Row={RecycleRow}
          getKey={item => `${item.table}:${item.id}`}
          grouping={grouping}
          rowProps={item => ({
            children: (
              <RecycleEntityRow item={item} deletedUsers={deletedUsers} />
            ),
          })}
        />
      )}
    </section>
  )
}
