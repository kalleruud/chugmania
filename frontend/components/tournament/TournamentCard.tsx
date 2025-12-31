import type { TournamentData, TournamentMatchWithMatch } from '@common/models/tournament'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { GroupCard } from './GroupCard'
import MatchRow from '../match/MatchRow'
import { Badge } from '../ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import ConfirmationButton from '@/components/ConfirmationButton'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function TournamentCard({ tournament }: { tournament: TournamentData }) {
  const { loggedInUser, isLoggedIn } = useAuth()
  const { socket } = useConnection()
  const canEdit = isLoggedIn && (loggedInUser.role === 'admin' || loggedInUser.role === 'moderator')

  // Group Matches by Bracket and Round
  const bracketMatches = tournament.matches.filter(m => m.bracket !== 'group')
  
  // Group by bracket
  const brackets: Record<string, TournamentMatchWithMatch[]> = {
      upper: bracketMatches.filter(m => m.bracket === 'upper'),
      lower: bracketMatches.filter(m => m.bracket === 'lower'),
  }

  const handleDelete = async () => {
    toast.promise(
      socket.emitWithAck('delete_tournament', {
         type: 'DeleteTournamentRequest',
         id: tournament.id
      }).then(res => {
          if (!res.success) throw new Error(res.message)
      }),
      {
          loading: 'Deleting tournament...',
          success: 'Tournament deleted',
          error: 'Failed to delete tournament'
      }
    )
  }

  return (
    <div className="space-y-6">
       <Card>
           <CardHeader>
               <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <CardTitle>{tournament.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{tournament.description}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Badge variant="secondary">{tournament.eliminationType === 'single' ? 'Single Elim' : 'Double Elim'}</Badge>
                        {canEdit && (
                            <ConfirmationButton
                                variant="ghost"
                                size="sm"
                                onClick={handleDelete}
                            >
                                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                            </ConfirmationButton>
                        )}
                    </div>
               </div>
           </CardHeader>
           <CardContent>
                {/* Groups Section */}
                <h3 className="text-lg font-bold mb-4">Group Stage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {tournament.groups.map(g => (
                        <GroupCard key={g.id} group={g} matches={tournament.matches} />
                    ))}
                </div>

                {/* Bracket Section */}
                <h3 className="text-lg font-bold mb-4">Bracket</h3>
                <div className="space-y-8">
                    {Object.entries(brackets).map(([key, matches]) => {
                        if (matches.length === 0) return null
                        return (
                            <div key={key}>
                                <h4 className="text-md font-semibold mb-2 capitalize">{key} Bracket</h4>
                                <BracketView matches={matches} tournament={tournament} />
                            </div>
                        )
                    })}
                </div>
           </CardContent>
       </Card>
    </div>
  )
}

function BracketView({ matches, tournament }: { matches: TournamentMatchWithMatch[], tournament: TournamentData }) {
    // Group by Round
    // Sort rounds
    const roundsMap = new Map<number, TournamentMatchWithMatch[]>()
    matches.forEach(m => {
        const list = roundsMap.get(m.round) || []
        list.push(m)
        roundsMap.set(m.round, list)
    })
    
    const rounds = Array.from(roundsMap.keys()).sort((a, b) => b - a)

    return (
        <div className="flex overflow-x-auto gap-8 pb-4">
            {rounds.map(r => {
                const roundMatches = roundsMap.get(r)!
                const roundName = roundMatches[0].name.split('-')[0] // simplistic naming extraction
                
                return (
                    <div key={r} className="min-w-[250px] space-y-4">
                        <div className="text-sm font-medium text-center text-muted-foreground mb-2">
                             {getRoundName(r)}
                        </div>
                        {roundMatches.map(m => (
                            <div key={m.id} className="border rounded-sm bg-card">
                                 <TournamentMatchRow match={m} tournament={tournament} />
                            </div>
                        ))}
                    </div>
                )
            })}
        </div>
    )
}

function getRoundName(round: number) {
    if (round === 1) return 'Final'
    if (round === 2) return 'Semi-Finals'
    if (round === 4) return 'Quarter-Finals'
    return `Round of ${round * 2}`
}

function TournamentMatchRow({ match, tournament }: { match: TournamentMatchWithMatch, tournament: TournamentData }) {
    if (match.matchData) {
        return <MatchRow item={match.matchData} hideTrack className="border-0 shadow-none" />
    }
    
    return (
        <div className="flex flex-col justify-center p-3 gap-1 text-xs text-muted-foreground bg-muted/20 h-[80px]">
             <div className="flex justify-between items-center">
                 <span>{getSourceLabel(match.sourceGroupA, match.sourceGroupARank, match.sourceMatchA, match.sourceMatchAProgression, tournament)}</span>
             </div>
             <div className="text-center font-bold opacity-30">vs</div>
             <div className="flex justify-between items-center">
                 <span>{getSourceLabel(match.sourceGroupB, match.sourceGroupBRank, match.sourceMatchB, match.sourceMatchBProgression, tournament)}</span>
             </div>
        </div>
    )
}

function getSourceLabel(
    groupId?: string | null, 
    rank?: number | null, 
    matchId?: string | null, 
    prog?: string | null,
    tournament?: TournamentData
) {
    if (groupId) {
        const group = tournament?.groups.find(g => g.id === groupId)
        return group ? `${group.name} #${rank}` : `Group #${rank}`
    }
    if (matchId) {
        const sourceMatch = tournament?.matches.find(m => m.id === matchId)
        const label = sourceMatch ? sourceMatch.name.split(' - ').pop() : 'Match'
        
        return `${prog === 'loser' ? 'Loser' : 'Winner'} of ${label}`
    }
    return 'TBD'
}
