import loc from '@common/locale/locales'
import type { Match } from '@common/models/match'
import type { TimeEntry } from '@common/models/timeEntry'
import type {
  TournamentConfig,
  TournamentDetails,
  TournamentStatus,
} from '@common/models/tournament'
import type { User } from '@common/models/user'
import { and, eq, isNull } from 'drizzle-orm'
import db from '../../../database/database'
import { tournamentMatches, tournaments, users } from '../../../database/schema'
import type { TypedSocket } from '../../server'

const activeDraft = and(
  eq(tournaments.status, 'draft'),
  isNull(tournaments.deletedAt)
)

export default class TournamentSecurity {
  private static viewer(userId: string): User | undefined {
    return db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .get()
  }

  private static canConfigure(
    user: User | undefined,
    config: TournamentConfig
  ): boolean {
    return !!user && (user.role === 'admin' || user.id === config.owner)
  }

  static authorize(
    userId: string,
    config: TournamentConfig,
    status: TournamentStatus,
    updatedConfig?: TournamentConfig
  ): void {
    const user = this.viewer(userId)
    const allowed =
      status === 'draft'
        ? this.canConfigure(user, config)
        : !!user && user.role !== 'user'
    if (!allowed || (updatedConfig && updatedConfig.owner !== config.owner))
      throw new Error(loc.no.error.messages.insufficient_permissions)
  }

  static view(
    details: TournamentDetails | null,
    userId: string
  ): TournamentDetails | null {
    const user = this.viewer(userId)
    return details && user ? this.project(details, user) : null
  }

  static emit(
    socket: TypedSocket,
    details: TournamentDetails[],
    actor: string | null = null
  ): void {
    const user = this.viewer(socket.data.userId)
    socket.emit(
      'all_tournaments',
      user ? details.map(detail => this.project(detail, user)) : [],
      actor
    )
  }

  static visibleMatches(rows: Match[]): Match[] {
    const hidden = new Set(
      db
        .select({ id: tournamentMatches.matchId })
        .from(tournamentMatches)
        .innerJoin(
          tournaments,
          eq(tournaments.id, tournamentMatches.tournament)
        )
        .where(activeDraft)
        .all()
        .map(row => row.id)
    )
    return rows.filter(row => !hidden.has(row.id))
  }

  static visibleTimeEntries(rows: TimeEntry[]): TimeEntry[] {
    const hidden = new Set(
      db
        .select({ session: tournaments.session })
        .from(tournaments)
        .where(activeDraft)
        .all()
        .map(row => row.session)
    )
    return rows.filter(
      row => !row.tieBreaker || !row.session || !hidden.has(row.session)
    )
  }

  private static hiddenTrack(match: Match): Match {
    return {
      id: match.id,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      deletedAt: match.deletedAt,
      session: match.session,
      stage: match.stage,
      user1: match.user1,
      user2: match.user2,
      winner: match.winner,
      status: match.status,
      duration: match.duration,
      comment: null,
      track: null,
      tournament: match.tournament
        ? {
            id: match.tournament.id,
            groupId: match.tournament.groupId,
            label: match.tournament.label,
            slot1: match.tournament.slot1,
            slot2: match.tournament.slot2,
            editableSlots: [],
            readOnly: true,
            awarded: match.tournament.awarded,
          }
        : undefined,
    }
  }

  private static project(
    details: TournamentDetails,
    user: User
  ): TournamentDetails {
    const canConfigure = this.canConfigure(user, details.config)
    if (details.status === 'started' || canConfigure)
      return { ...structuredClone(details), canConfigure }
    const visibility = details.config.previewVisibility
    const showMatches = visibility === 'visible' || visibility === 'hide_tracks'
    const showGroups = showMatches || visibility === 'groups_only'
    return {
      id: details.id,
      status: details.status,
      canConfigure: false,
      configKey: null,
      previewKey: null,
      config: {
        session: details.config.session,
        owner: null,
        previewVisibility: visibility,
        groupsCount: details.workloadSummary.groups,
        advancementCount: showGroups ? details.config.advancementCount : 0,
        eliminationType: showGroups ? details.config.eliminationType : 'single',
        stageTracks:
          visibility === 'visible'
            ? structuredClone(details.config.stageTracks)
            : {},
        tieBreakerTrack:
          visibility === 'visible' ? details.config.tieBreakerTrack : null,
      },
      cancelled: details.cancelled,
      notReadyReason:
        showGroups &&
        details.notReadyReason === loc.no.tournament.awaitingSignups
          ? details.notReadyReason
          : null,
      participants: showGroups ? structuredClone(details.participants) : [],
      groups: showGroups ? structuredClone(details.groups) : [],
      matches: showMatches
        ? details.matches.map(match =>
            visibility === 'visible'
              ? structuredClone(match)
              : this.hiddenTrack(match)
          )
        : [],
      tieBreakers: [],
      standings: [],
      completed: false,
      progress: showMatches
        ? { ...details.progress }
        : { decided: 0, total: 0, groupDecided: 0, groupTotal: 0 },
      workloadSummary: {
        participants: details.workloadSummary.participants,
        groups: details.workloadSummary.groups,
        matches: details.workloadSummary.matches,
        tracks: details.workloadSummary.tracks,
        minMatches: details.workloadSummary.minMatches,
        maxMatches: details.workloadSummary.maxMatches,
      },
    }
  }
}
