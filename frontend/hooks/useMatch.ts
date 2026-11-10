import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import { toast } from 'sonner'

export function useMatch(match: Match) {
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const canSetResult =
    isLoggedIn &&
    loggedInUser.role !== 'user' &&
    !match.tournament?.readOnly &&
    !!match.user1 &&
    !!match.user2

  function toggleWinner(userId: string) {
    if (!canSetResult) return
    const isWinner = match.winner === userId
    const payload: EditMatchRequest = {
      type: 'EditMatchRequest',
      id: match.id,
      winner: isWinner ? null : userId,
      status: isWinner ? 'planned' : 'completed',
    }
    toast.promise(
      socket.emitWithAck('edit_match', payload).then(r => {
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.match.toast.update
    )
  }

  return { canSetResult, toggleWinner }
}
