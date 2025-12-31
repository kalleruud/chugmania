import type { GroupWithPlayers, TournamentMatchWithMatch } from '@common/models/tournament'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface GroupCardProps {
  group: GroupWithPlayers
  matches: TournamentMatchWithMatch[]
}

export function GroupCard({ group, matches }: GroupCardProps) {
  // Calculate records
  const stats = new Map<string, { w: number; l: number }>()
  
  group.players.forEach(p => {
      stats.set(p.user.id, { w: 0, l: 0 })
  })

  const groupPlayerIds = new Set(group.players.map(p => p.user.id))
  
  matches.forEach(tm => {
      if (tm.bracket !== 'group') return
      const m = tm.matchData
      if (!m || m.status !== 'completed' || !m.winner) return
      
      if (groupPlayerIds.has(m.user1!) && groupPlayerIds.has(m.user2!)) {
          // Update stats
          const winnerStats = stats.get(m.winner)
          if (winnerStats) winnerStats.w++
          
          const loser = m.winner === m.user1 ? m.user2 : m.user1
          const loserStats = stats.get(loser!)
          if (loserStats) loserStats.l++
      }
  })

  // Sort players by Wins desc
  const sortedPlayers = [...group.players].sort((a, b) => {
      const statsA = stats.get(a.user.id) || { w: 0, l: 0 }
      const statsB = stats.get(b.user.id) || { w: 0, l: 0 }
      return statsB.w - statsA.w || a.seed - b.seed
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{group.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="text-sm">
            <div className="flex border-b p-2 font-medium text-muted-foreground">
                <div className="w-8 text-center">#</div>
                <div className="flex-1">Player</div>
                <div className="w-12 text-right">W-L</div>
            </div>
            {sortedPlayers.map((p, i) => {
               const s = stats.get(p.user.id) || { w: 0, l: 0 }
               return (
              <div key={p.user.id} className="flex items-center border-b last:border-0 p-2">
                <div className="w-8 text-center font-medium">{i + 1}</div>
                <div className="flex-1 flex items-center gap-2 truncate">
                   <span>{p.user.firstName} {p.user.lastName}</span>
                </div>
                <div className="w-12 text-right">{s.w}-{s.l}</div>
              </div>
            )})}
        </div>
      </CardContent>
    </Card>
  )
}
