import Manager from 'tournament-organizer'
import type { Tournament } from 'tournament-organizer/components'
import type { SettableTournamentValues } from 'tournament-organizer/interfaces'
import type { Session } from './session.manager'
import type { PublicUser } from './user.manager'
import type { Match } from './match.manager'

export default class TournamentManager {
  private static readonly manager = new Manager()
  private static readonly stageNames = [
    'R64',
    'R32',
    'R16',
    'Åttenedelsfinale',
    'Kvartfinale',
    'Bronsefinale',
    'Semifinale',
    'Finale',
  ]

  private readonly tournament: Tournament

  constructor(
    session: Session,
    players: PublicUser[],
    settings: SettableTournamentValues = {
      stageOne: {
        format: 'swiss',
        consolation: true,
      },
      stageTwo: {
        format: 'double-elimination',
        consolation: true,
      },
    }
  ) {
    if (session.type !== 'tournament') throw new Error('Session is not a tournament')
    if (!session.description) throw new Error('Session is missing description')
    this.tournament = TournamentManager.manager.createTournament(
      session.description,
      settings,
      session.id
    )
    players.forEach(player => this.tournament.createPlayer(player.shortName, player.id))
  }

  get id() {
    return this.tournament.id
  }

  start() {
    this.tournament.start()
  }

  get matches() {
    return this.tournament.matches.map(match => ({
      ...match,
      stage: TournamentManager.stageNames[match.],
    }))
  }
}
