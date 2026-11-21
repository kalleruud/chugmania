import type { useConnection } from '@/contexts/ConnectionContext'
import type { EditSessionRequest } from '@common/models/session'
import { toast } from 'sonner'

type SessionEdit = Omit<EditSessionRequest, 'type' | 'id'>

export function editSession(
  socket: ReturnType<typeof useConnection>['socket'],
  id: string,
  edit: SessionEdit,
  messages: Parameters<typeof toast.promise>[1]
) {
  const request = socket
    .emitWithAck('edit_session', { type: 'EditSessionRequest', id, ...edit })
    .then(r => {
      if (!r.success) throw new Error(r.message)
    })
  return toast.promise(request, messages)
}
