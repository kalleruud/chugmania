import type { Session } from '@/components/types.server'
import GroupManager, { type Group } from './group.manager'
import MatchManager, { type Match, type NewMatch } from './match.manager'
import type { Track } from './track.manager'
import type { PublicUser } from './user.manager'

export type BracketRound = Partial<Match> & {
  user1LastMatch: Partial<Match> | undefined
  user2LastMatch: Partial<Match> | undefined
}

export default class TournamentManager {
  static readonly finalNames = [
    'Sekstendelsfinale',
    'Åttenedelsfinale',
    'Kvartfinale',
    'Bronsefinale',
    'Semifinale',
    'Finale',
  ]

}
