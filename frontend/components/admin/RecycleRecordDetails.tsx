import ObjectViewer from '@/components/object-viewer/ObjectViewer'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import type { RecycleRecordRequest } from '@common/models/recycleBin'
import { useEffect, useState } from 'react'

export default function RecycleRecordDetails({
  table,
  id,
}: Readonly<RecycleRecordRequest>) {
  const { socket } = useConnection()
  const [record, setRecord] = useState<Record<string, unknown>>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const load = () => {
      socket
        .emitWithAck('get_recycle_record', { table, id })
        .then(response => {
          if (!active) return
          if (!response.success) {
            setError(response.message)
            return
          }
          setError(undefined)
          setRecord(response.record)
        })
        .catch((error: unknown) => {
          if (active)
            setError(error instanceof Error ? error.message : String(error))
        })
    }
    load()
    socket.on('recycle_bin_changed', load)
    return () => {
      active = false
      socket.off('recycle_bin_changed', load)
    }
  }, [socket, table, id, attempt])

  if (error)
    return (
      <div role='alert' className='flex flex-col items-start gap-3'>
        <p>{error}</p>
        <Button
          variant='outline'
          onClick={() => {
            setError(undefined)
            setAttempt(value => value + 1)
          }}>
          {loc.no.admin.recycleBin.retry}
        </Button>
      </div>
    )
  if (!record)
    return (
      <div className='flex justify-center p-8'>
        <Spinner />
      </div>
    )
  return <ObjectViewer value={record} />
}
