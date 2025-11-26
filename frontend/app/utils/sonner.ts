import { toast } from 'sonner'
import type {
  ErrorResponse,
  SuccessResponse,
} from '../../../common/models/socket.io'

type PromiseMessages = Parameters<typeof toast.promise>[1]
/**
 * Wraps toast.promise to handle responses with success: false
 * Converts ErrorResponse into a rejected promise for proper error display
 */
export function toastPromise<T extends SuccessResponse | ErrorResponse>(
  promise: Promise<T>,
  messages: PromiseMessages
) {
  return toast.promise(
    promise.then(response => {
      if (response.success) return response
      throw new Error(response.message)
    }),
    messages
  )
}
