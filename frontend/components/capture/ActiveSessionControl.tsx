import { toast } from 'sonner'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { Button } from '@/components/ui/button'

export function ActiveSessionControl({ sessionId }: { sessionId: string }) {
  const { socket } = useConnection()
  const { captureState } = useData()
  const isActive = captureState.activeSessionId === sessionId

  function setActive(active: boolean) {
    toast.promise(
      socket
        .emitWithAck('set_active_session', {
          type: 'SetActiveSessionRequest',
          sessionId: active ? sessionId : null,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.capture.activateRequest,
    )
  }

  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      onClick={() => setActive(!isActive)}
    >
      {isActive ? loc.no.capture.deactivate : loc.no.capture.activate}
    </Button>
  )
}
