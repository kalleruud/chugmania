import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isEditTournamentRequest,
  type TournamentWithStructure,
} from '@common/models/tournament'
import type { UserInfo } from '@common/models/user'
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
} from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import loc from '../../../frontend/lib/locales'
import db, { database } from '../../database/database'
import {
  groupPlayers,
  groups,
  matches,
  sessionSignups,
  sessions,
  tournamentMatches,
  tournaments,
  users,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import UserManager from './user.manager'

type SeededUser = { userId: UserInfo['id']; seed: number }

export default class TournamentManager {
  static async getAllTournaments(): Promise<TournamentWithStructure[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))
      .orderBy(desc(tournaments.createdAt))

    if (tournamentRows.length === 0) return []

    return await Promise.all(
      tournamentRows.map(async t => {
        const groupRows = await db
          .select()
          .from(groups)
          .where(and(eq(groups.tournament, t.id), isNull(groups.deletedAt)))
          .orderBy(asc(groups.createdAt))

        const groupIds = groupRows.map(g => g.id)
        const groupPlayerRows =
          groupIds.length === 0
            ? []
            : await db
                .select({
                  ...getTableColumns(groupPlayers),
                  user: users,
                })
                .from(groupPlayers)
                .innerJoin(users, eq(groupPlayers.user, users.id))
                .where(
                  and(
                    inArray(groupPlayers.group, groupIds),
                    isNull(groupPlayers.deletedAt),
                    isNull(users.deletedAt)
                  )
                )
                .orderBy(asc(groupPlayers.seed), asc(groupPlayers.createdAt))

        const groupsWithPlayers = groupRows.map(g => ({
          ...g,
          players: groupPlayerRows
            .filter(p => p.group === g.id)
            .map(p => ({
              ...p,
              user: UserManager.toUserInfo(p.user).userInfo,
            })),
        }))

        const tMatches = await db
          .select()
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournament, t.id),
              isNull(tournamentMatches.deletedAt)
            )
          )
          .orderBy(
            desc(tournamentMatches.bracket),
            desc(tournamentMatches.round)
          )

        return {
          ...t,
          groups: groupsWithPlayers,
          tournamentMatches: tMatches,
        }
      })
    )
  }

  static async onCreateTournament(
    socket: TypedSocket,
    request: EventReq<'create_tournament'>
  ): Promise<EventRes<'create_tournament'>> {
    if (!isCreateTournamentRequest(request)) {
      throw new Error(loc.no.error.messages.invalid_request('CreateTournament'))
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, request.session), isNull(sessions.deletedAt)),
    })
    if (!session)
      throw new Error(loc.no.error.messages.not_in_db(request.session))

    const tournamentId = request.id ?? randomUUID()

    await database.transaction(() => {
      db.insert(tournaments)
        .values({
          id: tournamentId,
          session: request.session,
          name: request.name,
          description: request.description ?? null,
          groupsCount: request.groupsCount,
          advancementCount: request.advancementCount,
          eliminationType: request.eliminationType,
        })
        .run()
    })()

    await TournamentManager.regenerateStructure(tournamentId)

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }

  static async onEditTournament(
    socket: TypedSocket,
    request: EventReq<'edit_tournament'>
  ): Promise<EventRes<'edit_tournament'>> {
    if (!isEditTournamentRequest(request)) {
      throw new Error(loc.no.error.messages.invalid_request('EditTournament'))
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const existing = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, request.id),
    })
    if (!existing) throw new Error(loc.no.error.messages.not_in_db(request.id))

    const { type, id, ...updates } = request

    await db
      .update(tournaments)
      .set({
        ...updates,
        deletedAt: updates.deletedAt ? new Date(updates.deletedAt) : undefined,
      })
      .where(eq(tournaments.id, id))

    const structuralChanged =
      (updates.groupsCount !== undefined &&
        updates.groupsCount !== existing.groupsCount) ||
      (updates.advancementCount !== undefined &&
        updates.advancementCount !== existing.advancementCount) ||
      (updates.eliminationType !== undefined &&
        updates.eliminationType !== existing.eliminationType)

    if (structuralChanged) {
      await TournamentManager.regenerateStructure(id)
      broadcast('all_matches', await MatchManager.getAllMatches())
    }

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    return { success: true }
  }

  static async onDeleteTournament(
    socket: TypedSocket,
    request: EventReq<'delete_tournament'>
  ): Promise<EventRes<'delete_tournament'>> {
    if (!isDeleteTournamentRequest(request)) {
      throw new Error(loc.no.error.messages.invalid_request('DeleteTournament'))
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    await TournamentManager.softDeleteTournament(request.id)
    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }

  static async onMatchCompleted(matchId: string): Promise<boolean> {
    const tMatch = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.match, matchId),
    })
    if (!tMatch) return false

    if (!tMatch.completedAt) {
      await db
        .update(tournamentMatches)
        .set({ completedAt: new Date() })
        .where(eq(tournamentMatches.id, tMatch.id))
    }

    await TournamentManager.refreshTournament(tMatch.tournament)
    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    return true
  }

  private static async softDeleteTournament(tournamentId: string) {
    const groupIds = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.tournament, tournamentId))
      .then(r => r.map(x => x.id))

    const tMatches = await db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournament, tournamentId))

    const matchIds = tMatches
      .map(m => m.match)
      .filter((id): id is string => !!id)

    const now = new Date()
    await database.transaction(() => {
      db.update(tournaments)
        .set({ deletedAt: now })
        .where(eq(tournaments.id, tournamentId))
        .run()
      db.update(groups)
        .set({ deletedAt: now })
        .where(eq(groups.tournament, tournamentId))
        .run()
      if (groupIds.length > 0) {
        db.update(groupPlayers)
          .set({ deletedAt: now })
          .where(inArray(groupPlayers.group, groupIds))
          .run()
      }
      db.update(tournamentMatches)
        .set({ deletedAt: now })
        .where(eq(tournamentMatches.tournament, tournamentId))
        .run()

      if (matchIds.length > 0) {
        db.update(matches)
          .set({ deletedAt: now })
          .where(inArray(matches.id, matchIds))
          .run()
      }
    })()
  }

  private static async regenerateStructure(tournamentId: string) {
    const tournament = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, tournamentId),
        isNull(tournaments.deletedAt)
      ),
    })
    if (!tournament)
      throw new Error(loc.no.error.messages.not_in_db(tournamentId))

    await TournamentManager.softDeleteTournamentStructureOnly(tournamentId)

    const players = await TournamentManager.getAttendingPlayers(
      tournament.session
    )
    if (players.length === 0) throw new Error('No attending players')

    if (tournament.groupsCount <= 0) throw new Error('groupsCount must be > 0')
    if (tournament.advancementCount <= 0)
      throw new Error('advancementCount must be > 0')

    const requiredAdvancers =
      tournament.groupsCount * tournament.advancementCount
    if (players.length < requiredAdvancers) {
      throw new Error(
        `Not enough players for ${tournament.groupsCount} groups with ${tournament.advancementCount} advancing`
      )
    }

    const bracketSize = requiredAdvancers
    if ((bracketSize & (bracketSize - 1)) !== 0) {
      throw new Error('Advancing player count must be a power of two')
    }

    const seeded = await TournamentManager.seedPlayers(players)
    const groupsData = TournamentManager.distributeIntoGroups(
      seeded,
      tournament.groupsCount
    )

    await TournamentManager.createGroupsAndPlayers(tournamentId, groupsData)
    await TournamentManager.createGroupStageMatches(
      tournamentId,
      tournament.session
    )
    await TournamentManager.createEliminationSlots(tournamentId, bracketSize)

    await TournamentManager.refreshTournament(tournamentId)
  }

  private static async softDeleteTournamentStructureOnly(tournamentId: string) {
    const groupIds = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.tournament, tournamentId))
      .then(r => r.map(x => x.id))

    const tMatches = await db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournament, tournamentId))

    const matchIds = tMatches
      .map(m => m.match)
      .filter((id): id is string => !!id)
    const now = new Date()

    await database.transaction(() => {
      db.update(groups)
        .set({ deletedAt: now })
        .where(eq(groups.tournament, tournamentId))
        .run()
      if (groupIds.length > 0) {
        db.update(groupPlayers)
          .set({ deletedAt: now })
          .where(inArray(groupPlayers.group, groupIds))
          .run()
      }
      db.update(tournamentMatches)
        .set({ deletedAt: now })
        .where(eq(tournamentMatches.tournament, tournamentId))
        .run()

      if (matchIds.length > 0) {
        db.update(matches)
          .set({ deletedAt: now })
          .where(inArray(matches.id, matchIds))
          .run()
      }
    })()
  }

  private static async getAttendingPlayers(
    sessionId: string
  ): Promise<UserInfo['id'][]> {
    const rows = await db
      .select({ userId: sessionSignups.user })
      .from(sessionSignups)
      .innerJoin(users, eq(sessionSignups.user, users.id))
      .where(
        and(
          eq(sessionSignups.session, sessionId),
          eq(sessionSignups.response, 'yes'),
          isNull(sessionSignups.deletedAt),
          isNull(users.deletedAt)
        )
      )
      .orderBy(asc(sessionSignups.createdAt))

    return rows.map(r => r.userId)
  }

  private static async seedPlayers(
    userIds: UserInfo['id'][]
  ): Promise<SeededUser[]> {
    const rankings = await RatingManager.onGetRatings()
    const rankByUser = new Map(rankings.map(r => [r.user, r.ranking]))

    const seeded = userIds
      .map(userId => ({
        userId,
        seed: rankByUser.get(userId) ?? Number.MAX_SAFE_INTEGER,
      }))
      .toSorted((a, b) => a.seed - b.seed)

    for (let i = 0; i < seeded.length; i++) {
      seeded[i] = { ...seeded[i], seed: i + 1 }
    }

    return seeded
  }

  private static distributeIntoGroups(
    players: SeededUser[],
    groupsCount: number
  ): SeededUser[][] {
    const groups: SeededUser[][] = Array.from({ length: groupsCount }, () => [])
    let direction: 1 | -1 = 1
    let idx = 0

    for (const player of players) {
      groups[idx].push(player)

      if (direction === 1 && idx === groupsCount - 1) {
        direction = -1
      } else if (direction === -1 && idx === 0) {
        direction = 1
      } else {
        idx += direction
      }
    }

    return groups
  }

  private static async createGroupsAndPlayers(
    tournamentId: string,
    groupData: SeededUser[][]
  ) {
    const groupIds = groupData.map(() => randomUUID())
    const groupNames = groupIds.map(
      (_, i) => `Group ${String.fromCharCode(65 + i)}`
    )

    await database.transaction(() => {
      db.insert(groups)
        .values(
          groupIds.map((id, i) => ({
            id,
            tournament: tournamentId,
            name: groupNames[i],
          }))
        )
        .run()

      const playerRows = groupData.flatMap((players, i) =>
        players.map((p, idx) => ({
          id: randomUUID(),
          group: groupIds[i],
          user: p.userId,
          seed: idx + 1,
        }))
      )

      if (playerRows.length > 0) {
        db.insert(groupPlayers).values(playerRows).run()
      }
    })()
  }

  private static async createGroupStageMatches(
    tournamentId: string,
    sessionId: string
  ) {
    const groupRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))

    for (const group of groupRows) {
      const players = await db
        .select()
        .from(groupPlayers)
        .where(
          and(eq(groupPlayers.group, group.id), isNull(groupPlayers.deletedAt))
        )
        .orderBy(asc(groupPlayers.seed))

      const userIds = players.map(p => p.user)
      const pairs: Array<{ a: string; b: string }> = []
      for (let i = 0; i < userIds.length; i++) {
        for (let j = i + 1; j < userIds.length; j++) {
          pairs.push({ a: userIds[i], b: userIds[j] })
        }
      }

      await database.transaction(() => {
        pairs.forEach((p, idx) => {
          const matchId = randomUUID()
          db.insert(matches)
            .values({
              id: matchId,
              user1: p.a,
              user2: p.b,
              session: sessionId,
              stage: 'group',
              status: 'planned',
            })
            .run()

          db.insert(tournamentMatches)
            .values({
              id: randomUUID(),
              tournament: tournamentId,
              name: `${group.name} Match ${idx + 1}`,
              bracket: 'group',
              round: 0,
              match: matchId,
            })
            .run()
        })
      })()
    }
  }

  private static bracketSeedOrder(size: number): number[] {
    let order = [1, 2]
    while (order.length < size) {
      const nextSize = order.length * 2
      const next: number[] = []
      for (const s of order) {
        next.push(s)
        next.push(nextSize + 1 - s)
      }
      order = next
    }
    return order
  }

  private static async createEliminationSlots(
    tournamentId: string,
    bracketSize: number
  ) {
    const groupRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))
      .orderBy(asc(groups.createdAt))

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    })
    if (!tournament)
      throw new Error(loc.no.error.messages.not_in_db(tournamentId))

    const placeholders: Array<{ groupId: string; rank: number }> = []
    for (let rank = 1; rank <= tournament.advancementCount; rank++) {
      for (const g of groupRows) {
        placeholders.push({ groupId: g.id, rank })
      }
    }

    const seedOrder = TournamentManager.bracketSeedOrder(bracketSize)
    const upperByRound = new Map<number, string[]>()

    await database.transaction(() => {
      for (
        let roundMatches = bracketSize / 2;
        roundMatches >= 1;
        roundMatches /= 2
      ) {
        const ids: string[] = []
        for (let i = 0; i < roundMatches; i++) {
          ids.push(randomUUID())
        }
        upperByRound.set(roundMatches, ids)

        for (let i = 0; i < roundMatches; i++) {
          const id = ids[i]
          const name =
            roundMatches === 1
              ? 'Upper Bracket Final'
              : `Upper Bracket Round ${roundMatches} Match ${i + 1}`

          const values: typeof tournamentMatches.$inferInsert = {
            id,
            tournament: tournamentId,
            name,
            bracket: 'upper',
            round: roundMatches,
            match: null,
          }

          if (roundMatches === bracketSize / 2) {
            const seedA = seedOrder[i * 2] - 1
            const seedB = seedOrder[i * 2 + 1] - 1
            const a = placeholders[seedA]
            const b = placeholders[seedB]
            values.sourceGroupA = a.groupId
            values.sourceGroupARank = a.rank
            values.sourceGroupB = b.groupId
            values.sourceGroupBRank = b.rank
          } else {
            const prevRound = roundMatches * 2
            const prevIds = upperByRound.get(prevRound)
            if (!prevIds) throw new Error('Invalid bracket generation')
            values.sourceMatchA = prevIds[i * 2]
            values.sourceMatchAProgression = 'winner'
            values.sourceMatchB = prevIds[i * 2 + 1]
            values.sourceMatchBProgression = 'winner'
          }

          db.insert(tournamentMatches).values(values).run()
        }
      }

      if (tournament.eliminationType === 'double') {
        TournamentManager.createDoubleElimLowerAndGrandFinal(
          tournamentId,
          bracketSize,
          upperByRound
        )
      }
    })()
  }

  private static createDoubleElimLowerAndGrandFinal(
    tournamentId: string,
    bracketSize: number,
    upperByRound: Map<number, string[]>
  ) {
    const rounds = Math.log2(bracketSize)
    const lowerByRound = new Map<number, string[]>()

    for (let lowerRound = 1; lowerRound <= 2 * rounds - 1; lowerRound++) {
      const k = Math.ceil(lowerRound / 2)
      const matchCount = bracketSize / 2 ** (k + 1)
      const ids = Array.from({ length: matchCount }, () => randomUUID())
      lowerByRound.set(lowerRound, ids)

      for (let i = 0; i < matchCount; i++) {
        const values: typeof tournamentMatches.$inferInsert = {
          id: ids[i],
          tournament: tournamentId,
          name: `Lower Bracket R${lowerRound} Match ${i + 1}`,
          bracket: 'lower',
          round: matchCount,
          match: null,
        }

        if (lowerRound === 1) {
          const upperRound1 = upperByRound.get(bracketSize / 2)
          if (!upperRound1) throw new Error('Invalid upper bracket')
          values.sourceMatchA = upperRound1[i * 2]
          values.sourceMatchAProgression = 'loser'
          values.sourceMatchB = upperRound1[i * 2 + 1]
          values.sourceMatchBProgression = 'loser'
        } else if (lowerRound % 2 === 0) {
          const prev = lowerByRound.get(lowerRound - 1)
          const upperRound = upperByRound.get(bracketSize / 2 ** (k + 1))
          if (!prev || !upperRound) throw new Error('Invalid bracket mapping')
          values.sourceMatchA = prev[i]
          values.sourceMatchAProgression = 'winner'
          values.sourceMatchB = upperRound[i]
          values.sourceMatchBProgression = 'loser'
        } else {
          const prev = lowerByRound.get(lowerRound - 1)
          if (!prev) throw new Error('Invalid bracket mapping')
          values.sourceMatchA = prev[i * 2]
          values.sourceMatchAProgression = 'winner'
          values.sourceMatchB = prev[i * 2 + 1]
          values.sourceMatchBProgression = 'winner'
        }

        db.insert(tournamentMatches).values(values).run()
      }
    }

    const upperFinal = upperByRound.get(1)?.[0]
    const lowerFinal = lowerByRound.get(2 * rounds - 1)?.[0]
    if (!upperFinal || !lowerFinal) throw new Error('Invalid final mapping')

    db.insert(tournamentMatches)
      .values({
        id: randomUUID(),
        tournament: tournamentId,
        name: 'Grand Final',
        bracket: 'upper',
        round: 1,
        match: null,
        sourceMatchA: upperFinal,
        sourceMatchAProgression: 'winner',
        sourceMatchB: lowerFinal,
        sourceMatchBProgression: 'winner',
      })
      .run()
  }

  private static async refreshTournament(tournamentId: string) {
    const tournament = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, tournamentId),
        isNull(tournaments.deletedAt)
      ),
    })
    if (!tournament) return

    const tMatches = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          isNull(tournamentMatches.deletedAt)
        )
      )
      .orderBy(desc(tournamentMatches.createdAt))

    const byId = new Map(tMatches.map(m => [m.id, m]))
    const matchIds = tMatches
      .map(m => m.match)
      .filter((id): id is string => !!id)
    const matchRows =
      matchIds.length === 0
        ? []
        : await db.select().from(matches).where(inArray(matches.id, matchIds))
    const matchById = new Map(matchRows.map(m => [m.id, m]))

    const pending = tMatches.filter(m => !m.match && m.bracket !== 'group')
    for (const slot of pending) {
      const userA = await TournamentManager.resolveSlotUser(
        tournament,
        slot,
        'A',
        byId,
        matchById
      )
      const userB = await TournamentManager.resolveSlotUser(
        tournament,
        slot,
        'B',
        byId,
        matchById
      )
      if (!userA || !userB) continue
      if (userA === userB) continue

      const stage = TournamentManager.inferStage(slot.bracket, slot.round)
      const matchId = randomUUID()
      await database.transaction(() => {
        db.insert(matches)
          .values({
            id: matchId,
            user1: userA,
            user2: userB,
            session: tournament.session,
            stage,
            status: 'planned',
          })
          .run()

        db.update(tournamentMatches)
          .set({ match: matchId })
          .where(eq(tournamentMatches.id, slot.id))
          .run()
      })()
    }
  }

  private static inferStage(
    bracket: 'upper' | 'lower' | 'group',
    round: number
  ) {
    if (bracket === 'group') return 'group'
    if (bracket === 'upper') {
      if (round >= 8) return 'eight'
      if (round === 4) return 'quarter'
      if (round === 2) return 'semi'
      if (round === 1) return 'final'
      return 'final'
    }
    if (round >= 8) return 'loser_eight'
    if (round === 4) return 'loser_quarter'
    if (round === 2) return 'loser_semi'
    if (round === 1) return 'loser_final'
    return 'loser_final'
  }

  private static async resolveSlotUser(
    tournament: typeof tournaments.$inferSelect,
    slot: typeof tournamentMatches.$inferSelect,
    side: 'A' | 'B',
    byId: Map<string, typeof tournamentMatches.$inferSelect>,
    matchById: Map<string, typeof matches.$inferSelect>
  ): Promise<string | null> {
    if (side === 'A') {
      if (slot.sourceGroupA && slot.sourceGroupARank) {
        return await TournamentManager.resolveGroupRank(
          tournament.session,
          slot.sourceGroupA,
          slot.sourceGroupARank
        )
      }
      if (slot.sourceMatchA && slot.sourceMatchAProgression) {
        return TournamentManager.resolveFromMatch(
          slot.sourceMatchA,
          slot.sourceMatchAProgression,
          byId,
          matchById
        )
      }
      return null
    }

    if (slot.sourceGroupB && slot.sourceGroupBRank) {
      return await TournamentManager.resolveGroupRank(
        tournament.session,
        slot.sourceGroupB,
        slot.sourceGroupBRank
      )
    }
    if (slot.sourceMatchB && slot.sourceMatchBProgression) {
      return TournamentManager.resolveFromMatch(
        slot.sourceMatchB,
        slot.sourceMatchBProgression,
        byId,
        matchById
      )
    }
    return null
  }

  private static async resolveGroupRank(
    sessionId: string,
    groupId: string,
    rank: number
  ): Promise<string | null> {
    const players = await db
      .select()
      .from(groupPlayers)
      .where(
        and(eq(groupPlayers.group, groupId), isNull(groupPlayers.deletedAt))
      )
      .orderBy(asc(groupPlayers.seed))

    if (players.length < rank) return null

    const userIds = players.map(p => p.user)
    const totalMatches = (userIds.length * (userIds.length - 1)) / 2

    const groupMatchRows = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.session, sessionId),
          eq(matches.stage, 'group'),
          isNull(matches.deletedAt),
          inArray(matches.user1, userIds),
          inArray(matches.user2, userIds)
        )
      )

    const completed = groupMatchRows.filter(
      m => m.status === 'completed' && !!m.winner
    )
    if (completed.length < totalMatches) return null

    const wins = new Map<string, number>(userIds.map(id => [id, 0]))
    for (const m of completed) {
      if (!m.winner) continue
      wins.set(m.winner, (wins.get(m.winner) ?? 0) + 1)
    }

    const seedByUser = new Map(players.map(p => [p.user, p.seed]))
    const sorted = userIds.toSorted((a, b) => {
      const winA = wins.get(a) ?? 0
      const winB = wins.get(b) ?? 0
      if (winA !== winB) return winB - winA
      return (seedByUser.get(a) ?? 999) - (seedByUser.get(b) ?? 999)
    })

    return sorted[rank - 1] ?? null
  }

  private static resolveFromMatch(
    sourceTournamentMatchId: string,
    progression: 'winner' | 'loser',
    byId: Map<string, typeof tournamentMatches.$inferSelect>,
    matchById: Map<string, typeof matches.$inferSelect>
  ): string | null {
    const source = byId.get(sourceTournamentMatchId)
    if (!source?.match) return null

    const match = matchById.get(source.match)
    if (!match) return null
    if (match.status !== 'completed' || !match.winner) return null
    if (!match.user1 || !match.user2) return null

    if (progression === 'winner') return match.winner

    return match.winner === match.user1 ? match.user2 : match.user1
  }
}
