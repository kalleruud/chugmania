import type { BaseRowProps } from '@/components/row/RowProps'
import { Button } from '@/components/ui/button'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import type { RecycleItem, RecycleRequest } from '@common/models/recycleBin'
import { DEFAULT_LOCALE, DEFAULT_ZONE } from '@common/utils/date'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { toast } from 'sonner'

export default function RecycleRow({
  item,
  children,
}: Readonly<BaseRowProps<RecycleItem>>) {
  const { socket } = useConnection()
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  async function mutate(action: RecycleRequest['action']) {
    setPending(true)
    try {
      const response = await socket.emitWithAck('mutate_recycle_bin', {
        table: item.table,
        id: item.id,
        action,
      })
      if (!response.success) throw new Error(response.message)
      toast.success(
        action === 'restore'
          ? loc.no.admin.recycleBin.restored
          : loc.no.admin.recycleBin.removed
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setPending(false)
      setConfirmDelete(false)
    }
  }
  const date = DateTime.fromJSDate(item.deletedAt)
    .setZone(DEFAULT_ZONE)
    .setLocale(DEFAULT_LOCALE)
    .toLocaleString(DateTime.DATETIME_MED)
  return (
    <article className='rounded-sm border bg-background-secondary p-2'>
      <div className='pointer-events-none'>{children}</div>
      <div className='flex flex-wrap items-center justify-between gap-2 p-2'>
        <span className='text-sm text-muted-foreground'>
          {loc.no.admin.recycleBin.deleted}{' '}
          <time dateTime={item.deletedAt.toISOString()}>{date}</time>
        </span>
        <div className='flex flex-wrap gap-2'>
          <Button
            size='sm'
            variant='outline'
            disabled={pending}
            onClick={() => mutate('restore')}>
            {loc.no.admin.recycleBin.restore}
          </Button>
          {!confirmDelete && (
            <Button
              size='sm'
              variant='destructive'
              disabled={pending}
              onClick={() => setConfirmDelete(true)}>
              {loc.no.admin.recycleBin.delete}
            </Button>
          )}
          {confirmDelete && (
            <>
              <span className='text-sm'>{loc.no.admin.recycleBin.warning}</span>
              <Button
                size='sm'
                variant='destructive'
                disabled={pending}
                onClick={() => mutate('delete')}>
                {loc.no.admin.recycleBin.confirm}
              </Button>
              <Button
                size='sm'
                variant='outline'
                disabled={pending}
                onClick={() => setConfirmDelete(false)}>
                {loc.no.admin.recycleBin.cancel}
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
