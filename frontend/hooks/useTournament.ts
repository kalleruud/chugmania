import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import type {
  TournamentChange,
  TournamentDetails,
} from '@common/models/tournament'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function useTournament(session: string) {
  const { socket } = useConnection()
  const [state, setState] = useState<{
    session: string
    details: TournamentDetails | null
  } | null>(null)
  useEffect(() => {
    let active = true
    let version = 0
    async function load() {
      const requestVersion = ++version
      try {
        const response = await socket.emitWithAck('get_tournament', { session })
        if (!active || requestVersion !== version) return
        if (!response.success) throw new Error(response.message)
        setState({ session, details: response.details })
      } catch (error) {
        if (!active || requestVersion !== version) return
        setState({ session, details: null })
        toast.error(error instanceof Error ? error.message : String(error))
      }
    }
    function changed(change: TournamentChange) {
      if (!active || change.session !== session) return
      void load()
      if (change.actor !== socket.id) toast.info(loc.no.tournament.changed)
    }
    socket.on('tournament_changed', changed)
    socket.on('connect', load)
    if (socket.connected) void load()
    return () => {
      active = false
      socket.off('tournament_changed', changed)
      socket.off('connect', load)
      socket.emit('unsubscribe_tournament', { session })
    }
  }, [session, socket])
  return {
    details: state?.session === session ? state.details : null,
    loading: state?.session !== session,
  }
}
