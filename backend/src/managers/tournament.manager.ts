import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isEditTournamentRequest,
  type TournamentWithDetails,
} from '@common/models/tournament'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import {
  groupPlayers,
  groups,
  matches,
  tournamentMatches,
  tournaments,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import SessionManager from './session.manager'
import UserManager from './user.manager'

export default class TournamentManager {
  private static async seedAndGroupPlayers(
    tournamentId: string,
    sessionId: string,
    groupsCount: number,
    advancementCount: number
  ): Promise<string[]> {
    const signups = await SessionManager.getSessionSignups(sessionId)
    const players = signups
      .filter(s => s.response === 'yes')
      .map(s => s.user.id)
      .sort(() => Math.random() - 0.5)

    if (players.length === 0) {
      throw new Error('No players with response "yes" found in session')
    }

    const groupIds: string[] = []
    const playersPerGroup = Math.ceil(players.length / groupsCount)

    for (let i = 0; i < groupsCount; i++) {
      const groupName = String.fromCharCode(65 + i)
      const [group] = await db
        .insert(groups)
        .values({
          tournament: tournamentId,
          name: `Group ${groupName}`,
        })
        .returning()

      if (!group) throw new Error('Failed to create group')
      groupIds.push(group.id)

      const groupStart = i * playersPerGroup
      const groupEnd = Math.min(groupStart + playersPerGroup, players.length)
      const groupPlayerIds = players.slice(groupStart, groupEnd)

      for (let j = 0; j < groupPlayerIds.length; j++) {
        await db.insert(groupPlayers).values({
          group: group.id,
          user: groupPlayerIds[j],
          seed: j + 1,
        })
      }
    }

    return groupIds
  }

  private static calculateRoundValue(roundNumber: number): number {
    return Math.pow(2, roundNumber - 1)
  }

  private static async generateBracketSlots(
    tournamentId: string,
    eliminationType: 'single' | 'double',
    groupIds: string[],
    advancementCount: number
  ): Promise<void> {
    const totalAdvancing = groupIds.length * advancementCount

    if (eliminationType === 'single') {
      await TournamentManager.generateSingleEliminationBracket(
        tournamentId,
        totalAdvancing
      )
    } else {
      await TournamentManager.generateDoubleEliminationBracket(
        tournamentId,
        totalAdvancing
      )
    }
  }

  private static async generateSingleEliminationBracket(
    tournamentId: string,
    totalPlayers: number
  ): Promise<void> {
    const rounds = Math.ceil(Math.log2(totalPlayers))
    const slots: Array<{
      name: string
      bracket: 'upper'
      round: number
      sourceGroupA?: string
      sourceGroupARank?: number
      sourceGroupB?: string
      sourceGroupBRank?: number
      sourceMatchA?: string
      sourceMatchB?: string
    }> = []

    for (let round = rounds; round >= 1; round--) {
      const roundValue = TournamentManager.calculateRoundValue(round)
      const matchesInRound = Math.floor(totalPlayers / roundValue / 2)

      for (let match = 0; match < matchesInRound; match++) {
        const matchNum = match + 1
        let name = ''
        if (round === rounds) {
          name = `Upper Bracket Round of ${totalPlayers} Match ${matchNum}`
        } else if (round === 1) {
          name = 'Upper Bracket Final'
        } else {
          const roundSize = totalPlayers / roundValue
          name = `Upper Bracket ${roundSize === 4 ? 'Semi' : roundSize === 8 ? 'Quarter' : 'Round'} ${matchNum}`
        }

        const slot: (typeof slots)[0] = {
          name,
          bracket: 'upper',
          round: roundValue,
        }

        if (round === rounds) {
          const groupIndexA = Math.floor((match * 2) / advancementCount)
          const groupIndexB = Math.floor((match * 2 + 1) / advancementCount)
          const rankA = ((match * 2) % advancementCount) + 1
          const rankB = ((match * 2 + 1) % advancementCount) + 1

          if (groupIndexA < groupIds.length) {
            slot.sourceGroupA = groupIds[groupIndexA]
            slot.sourceGroupARank = rankA
          }
          if (groupIndexB < groupIds.length) {
            slot.sourceGroupB = groupIds[groupIndexB]
            slot.sourceGroupBRank = rankB
          }
        } else {
          const prevRoundValue = TournamentManager.calculateRoundValue(
            round + 1
          )
          const prevMatchA = match * 2
          const prevMatchB = match * 2 + 1
          const prevRoundMatches = Math.floor(totalPlayers / prevRoundValue / 2)

          if (prevMatchA < prevRoundMatches) {
            slot.sourceMatchA = `temp_${round + 1}_${prevMatchA}`
          }
          if (prevMatchB < prevRoundMatches) {
            slot.sourceMatchB = `temp_${round + 1}_${prevMatchB}`
          }
        }

        slots.push(slot)
      }
    }

    const createdSlots = await db
      .insert(tournamentMatches)
      .values(
        slots.map(slot => ({
          tournament: tournamentId,
          name: slot.name,
          bracket: slot.bracket,
          round: slot.round,
          sourceGroupA: slot.sourceGroupA,
          sourceGroupARank: slot.sourceGroupARank,
          sourceGroupB: slot.sourceGroupB,
          sourceGroupBRank: slot.sourceGroupBRank,
        }))
      )
      .returning()

    const slotMap = new Map<string, string>()
    for (let i = 0; i < createdSlots.length; i++) {
      const slot = slots[i]
      if (slot.sourceMatchA?.startsWith('temp_')) {
        slotMap.set(slot.sourceMatchA, createdSlots[i].id)
      }
      if (slot.sourceMatchB?.startsWith('temp_')) {
        slotMap.set(slot.sourceMatchB, createdSlots[i].id)
      }
    }

    for (const slot of createdSlots) {
      const originalSlot = slots.find(
        s => s.name === slot.name && s.round === slot.round
      )
      if (!originalSlot) continue

      const updates: Partial<typeof tournamentMatches.$inferInsert> = {}
      if (originalSlot.sourceMatchA?.startsWith('temp_')) {
        updates.sourceMatchA = slotMap.get(originalSlot.sourceMatchA)
        updates.sourceMatchAProgression = 'winner'
      }
      if (originalSlot.sourceMatchB?.startsWith('temp_')) {
        updates.sourceMatchB = slotMap.get(originalSlot.sourceMatchB)
        updates.sourceMatchBProgression = 'winner'
      }

      if (Object.keys(updates).length > 0) {
        await db
          .update(tournamentMatches)
          .set(updates)
          .where(eq(tournamentMatches.id, slot.id))
      }
    }
  }

  private static async generateDoubleEliminationBracket(
    tournamentId: string,
    totalPlayers: number
  ): Promise<void> {
    await TournamentManager.generateSingleEliminationBracket(
      tournamentId,
      totalPlayers
    )

    const upperBracketSlots = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.bracket, 'upper')
        )
      )

    const rounds = Math.ceil(Math.log2(totalPlayers))
    const lowerRounds = rounds * 2 - 1

    for (let round = 1; round <= lowerRounds; round++) {
      const roundValue = TournamentManager.calculateRoundValue(round)
      const matchesInRound = Math.floor(totalPlayers / roundValue / 2)

      for (let match = 0; match < matchesInRound; match++) {
        const matchNum = match + 1
        let name = ''
        if (round === 1) {
          name = `Lower Bracket Round 1 Match ${matchNum}`
        } else if (round === lowerRounds) {
          name = 'Lower Bracket Final'
        } else {
          const roundSize = totalPlayers / roundValue
          name = `Lower Bracket ${roundSize === 4 ? 'Semi' : roundSize === 8 ? 'Quarter' : 'Round'} ${matchNum}`
        }

        const slot: Partial<typeof tournamentMatches.$inferInsert> = {
          tournament: tournamentId,
          name,
          bracket: 'lower',
          round: roundValue,
        }

        if (round === 1) {
          const upperRound = rounds
          const upperMatch = Math.floor(match / 2)
          const upperSlot = upperBracketSlots.find(
            s => s.round === TournamentManager.calculateRoundValue(upperRound)
          )
          if (upperSlot) {
            slot.sourceMatchA = upperSlot.id
            slot.sourceMatchAProgression = 'loser'
          }
        } else {
          const prevLowerMatch = Math.floor(match / 2)
          const prevLowerRound = round - 1
          const prevLowerSlots = await db
            .select()
            .from(tournamentMatches)
            .where(
              and(
                eq(tournamentMatches.tournament, tournamentId),
                eq(tournamentMatches.bracket, 'lower'),
                eq(
                  tournamentMatches.round,
                  TournamentManager.calculateRoundValue(prevLowerRound)
                )
              )
            )

          if (prevLowerSlots[prevLowerMatch]) {
            slot.sourceMatchA = prevLowerSlots[prevLowerMatch].id
            slot.sourceMatchAProgression = 'winner'
          }

          const upperRound = rounds - Math.floor((round - 1) / 2)
          const upperMatch = Math.floor(match / 2)
          const upperSlot = upperBracketSlots.find(
            s => s.round === TournamentManager.calculateRoundValue(upperRound)
          )
          if (upperSlot) {
            slot.sourceMatchB = upperSlot.id
            slot.sourceMatchBProgression = 'loser'
          }
        }

        await db.insert(tournamentMatches).values(slot)
      }
    }

    const grandFinalSlot: Partial<typeof tournamentMatches.$inferInsert> = {
      tournament: tournamentId,
      name: 'Grand Final',
      bracket: 'lower',
      round: TournamentManager.calculateRoundValue(lowerRounds + 1),
    }

    const upperFinal = upperBracketSlots.find(
      s => s.round === TournamentManager.calculateRoundValue(1)
    )
    const lowerFinal = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.bracket, 'lower'),
          eq(
            tournamentMatches.round,
            TournamentManager.calculateRoundValue(lowerRounds)
          )
        )
      )
      .then(slots => slots[0])

    if (upperFinal) {
      grandFinalSlot.sourceMatchA = upperFinal.id
      grandFinalSlot.sourceMatchAProgression = 'winner'
    }
    if (lowerFinal) {
      grandFinalSlot.sourceMatchB = lowerFinal.id
      grandFinalSlot.sourceMatchBProgression = 'winner'
    }

    await db.insert(tournamentMatches).values(grandFinalSlot)
  }

  private static async createGroupMatches(
    tournamentId: string,
    sessionId: string,
    groupIds: string[]
  ): Promise<void> {
    for (const groupId of groupIds) {
      const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
      })

      if (!group) continue

      const groupPlayersList = await db
        .select({
          user: groupPlayers.user,
          seed: groupPlayers.seed,
        })
        .from(groupPlayers)
        .where(eq(groupPlayers.group, groupId))

      let matchNumber = 1
      for (let i = 0; i < groupPlayersList.length; i++) {
        for (let j = i + 1; j < groupPlayersList.length; j++) {
          const [match] = await db
            .insert(matches)
            .values({
              user1: groupPlayersList[i].user,
              user2: groupPlayersList[j].user,
              session: sessionId,
              status: 'planned',
              stage: 'group',
            })
            .returning()

          if (!match) continue

          await db.insert(tournamentMatches).values({
            tournament: tournamentId,
            name: `${group.name} Match ${matchNumber}`,
            bracket: 'group',
            round: 0,
            match: match.id,
          })

          matchNumber++
        }
      }
    }
  }

  public static async getAllTournaments(): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))

    return Promise.all(
      tournamentRows.map(async tournament => {
        const groupsList = await db
          .select()
          .from(groups)
          .where(
            and(eq(groups.tournament, tournament.id), isNull(groups.deletedAt))
          )

        const groupsWithPlayers = await Promise.all(
          groupsList.map(async group => {
            const playersList = await db
              .select()
              .from(groupPlayers)
              .where(
                and(
                  eq(groupPlayers.group, group.id),
                  isNull(groupPlayers.deletedAt)
                )
              )

            const playersWithUsers = await Promise.all(
              playersList.map(async gp => {
                const user = await UserManager.getUserById(gp.user)
                const { userInfo } = UserManager.toUserInfo(user)
                return {
                  ...gp,
                  user: userInfo,
                }
              })
            )

            return {
              ...group,
              players: playersWithUsers,
            }
          })
        )

        const tournamentMatchesList = await db
          .select()
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournament, tournament.id),
              isNull(tournamentMatches.deletedAt)
            )
          )

        const tournamentMatchesWithMatch = await Promise.all(
          tournamentMatchesList.map(async tm => {
            if (!tm.match) {
              return { ...tm, match: null }
            }

            const match = await db.query.matches.findFirst({
              where: eq(matches.id, tm.match),
            })

            return {
              ...tm,
              match: match || null,
            }
          })
        )

        return {
          ...tournament,
          groups: groupsWithPlayers,
          tournamentMatches: tournamentMatchesWithMatch,
        }
      })
    )
  }

  static async onCreateTournament(
    socket: TypedSocket,
    request: EventReq<'create_tournament'>
  ): Promise<EventRes<'create_tournament'>> {
    if (!isCreateTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('CreateTournamentRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const session = await SessionManager.getSession(request.session)
    if (!session) {
      throw new Error(loc.no.error.messages.not_in_db(request.session))
    }

    const { type, createdAt, updatedAt, deletedAt, ...tournamentData } = request
    const [tournament] = await db
      .insert(tournaments)
      .values(tournamentData)
      .returning()

    if (!tournament) {
      throw new Error('Failed to create tournament')
    }

    const groupIds = await TournamentManager.seedAndGroupPlayers(
      tournament.id,
      request.session,
      request.groupsCount,
      request.advancementCount
    )

    await TournamentManager.generateBracketSlots(
      tournament.id,
      request.eliminationType,
      groupIds,
      request.advancementCount
    )

    await TournamentManager.createGroupMatches(
      tournament.id,
      request.session,
      groupIds
    )

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created tournament',
      tournament.name
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())

    return { success: true }
  }

  static async onEditTournament(
    socket: TypedSocket,
    request: EventReq<'edit_tournament'>
  ): Promise<EventRes<'edit_tournament'>> {
    if (!isEditTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('EditTournamentRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, request.id),
    })

    if (!tournament) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    const structuralChanged =
      (request.groupsCount !== undefined &&
        request.groupsCount !== tournament.groupsCount) ||
      (request.advancementCount !== undefined &&
        request.advancementCount !== tournament.advancementCount) ||
      (request.eliminationType !== undefined &&
        request.eliminationType !== tournament.eliminationType)

    if (structuralChanged) {
      const existingGroups = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.tournament, tournament.id))

      const existingGroupIds = existingGroups.map(g => g.id)

      if (existingGroupIds.length > 0) {
        await db
          .update(groupPlayers)
          .set({ deletedAt: new Date() })
          .where(inArray(groupPlayers.group, existingGroupIds))
      }

      await db
        .update(groups)
        .set({ deletedAt: new Date() })
        .where(eq(groups.tournament, tournament.id))

      await db
        .update(tournamentMatches)
        .set({ deletedAt: new Date() })
        .where(eq(tournamentMatches.tournament, tournament.id))

      const groupsCount = request.groupsCount ?? tournament.groupsCount
      const advancementCount =
        request.advancementCount ?? tournament.advancementCount
      const eliminationType =
        request.eliminationType ?? tournament.eliminationType

      const groupIds = await TournamentManager.seedAndGroupPlayers(
        tournament.id,
        tournament.session,
        groupsCount,
        advancementCount
      )

      await TournamentManager.generateBracketSlots(
        tournament.id,
        eliminationType,
        groupIds,
        advancementCount
      )

      await TournamentManager.createGroupMatches(
        tournament.id,
        tournament.session,
        groupIds
      )
    }

    const { type, id, createdAt, updatedAt, ...updates } = request
    const res = await db
      .update(tournaments)
      .set({
        ...updates,
        deletedAt: updates.deletedAt
          ? new Date(updates.deletedAt)
          : updates.deletedAt,
      })
      .where(eq(tournaments.id, tournament.id))

    if (res.changes === 0) {
      throw new Error(loc.no.error.messages.update_failed)
    }

    console.debug(new Date().toISOString(), socket.id, 'Updated tournament', id)

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())

    return { success: true }
  }

  static async onDeleteTournament(
    socket: TypedSocket,
    request: EventReq<'delete_tournament'>
  ): Promise<EventRes<'delete_tournament'>> {
    if (!isDeleteTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DeleteTournamentRequest')
      )
    }

    await TournamentManager.onEditTournament(socket, {
      ...request,
      type: 'EditTournamentRequest',
      deletedAt: new Date(),
    })

    const tournamentGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.tournament, request.id))

    const groupIds = tournamentGroups.map(g => g.id)

    if (groupIds.length > 0) {
      await db
        .update(groupPlayers)
        .set({ deletedAt: new Date() })
        .where(inArray(groupPlayers.group, groupIds))
    }

    await db
      .update(tournamentMatches)
      .set({ deletedAt: new Date() })
      .where(eq(tournamentMatches.tournament, request.id))

    return {
      success: true,
    }
  }

  static async onMatchCompleted(matchId: string): Promise<void> {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })

    if (!match || match.status !== 'completed' || !match.winner) {
      return
    }

    const tournamentMatch = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.match, matchId),
    })

    if (!tournamentMatch) {
      return
    }

    await db
      .update(tournamentMatches)
      .set({ completedAt: new Date() })
      .where(eq(tournamentMatches.id, tournamentMatch.id))

    if (tournamentMatch.bracket === 'group') {
      const tournament = await db.query.tournaments.findFirst({
        where: eq(tournaments.id, tournamentMatch.tournament),
      })

      if (tournament) {
        const bracketSlots = await db
          .select()
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournament, tournamentMatch.tournament),
              or(
                eq(tournamentMatches.bracket, 'upper'),
                eq(tournamentMatches.bracket, 'lower')
              ),
              or(
                tournamentMatches.sourceGroupA !== null,
                tournamentMatches.sourceGroupB !== null
              )
            )
          )

        for (const slot of bracketSlots) {
          await TournamentManager.checkAndCreateMatch(slot)
        }
      }
    } else {
      const downstreamSlots = await db
        .select()
        .from(tournamentMatches)
        .where(
          or(
            eq(tournamentMatches.sourceMatchA, tournamentMatch.id),
            eq(tournamentMatches.sourceMatchB, tournamentMatch.id)
          )
        )

      for (const slot of downstreamSlots) {
        await TournamentManager.checkAndCreateMatch(slot)
      }
    }

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await MatchManager.getAllMatches())
  }

  private static async checkAndCreateMatch(
    slot: typeof tournamentMatches.$inferSelect
  ): Promise<void> {
    let user1: string | null = null
    let user2: string | null = null

    if (slot.sourceMatchA) {
      const sourceMatch = await db.query.tournamentMatches.findFirst({
        where: eq(tournamentMatches.id, slot.sourceMatchA),
      })

      if (!sourceMatch || !sourceMatch.match || !sourceMatch.completedAt) {
        return
      }

      const match = await db.query.matches.findFirst({
        where: eq(matches.id, sourceMatch.match),
      })

      if (!match || !match.winner) {
        return
      }

      if (slot.sourceMatchAProgression === 'winner') {
        user1 = match.winner
      } else {
        user1 = match.user1 === match.winner ? match.user2 : match.user1
      }
    } else if (slot.sourceGroupA && slot.sourceGroupARank) {
      const groupPlayer = await db.query.groupPlayers.findFirst({
        where: and(
          eq(groupPlayers.group, slot.sourceGroupA),
          eq(groupPlayers.seed, slot.sourceGroupARank)
        ),
      })

      if (!groupPlayer) {
        return
      }

      const groupPlayersList = await db
        .select({ user: groupPlayers.user })
        .from(groupPlayers)
        .where(eq(groupPlayers.group, slot.sourceGroupA))

      const groupUserIds = groupPlayersList.map(gp => gp.user)

      const tournament = await db.query.tournaments.findFirst({
        where: eq(tournaments.id, slot.tournament),
      })

      if (!tournament) {
        return
      }

      const groupMatches = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.session, tournament.session),
            eq(matches.stage, 'group'),
            or(
              inArray(matches.user1, groupUserIds),
              inArray(matches.user2, groupUserIds)
            )
          )
        )

      const allCompleted = groupMatches.every(
        m => m.status === 'completed' && m.winner !== null
      )

      if (!allCompleted) {
        return
      }

      user1 = groupPlayer.user
    }

    if (slot.sourceMatchB) {
      const sourceMatch = await db.query.tournamentMatches.findFirst({
        where: eq(tournamentMatches.id, slot.sourceMatchB),
      })

      if (!sourceMatch || !sourceMatch.match || !sourceMatch.completedAt) {
        return
      }

      const match = await db.query.matches.findFirst({
        where: eq(matches.id, sourceMatch.match),
      })

      if (!match || !match.winner) {
        return
      }

      if (slot.sourceMatchBProgression === 'winner') {
        user2 = match.winner
      } else {
        user2 = match.user1 === match.winner ? match.user2 : match.user1
      }
    } else if (slot.sourceGroupB && slot.sourceGroupBRank) {
      const groupPlayer = await db.query.groupPlayers.findFirst({
        where: and(
          eq(groupPlayers.group, slot.sourceGroupB),
          eq(groupPlayers.seed, slot.sourceGroupBRank)
        ),
      })

      if (!groupPlayer) {
        return
      }

      const groupPlayersList = await db
        .select({ user: groupPlayers.user })
        .from(groupPlayers)
        .where(eq(groupPlayers.group, slot.sourceGroupB))

      const groupUserIds = groupPlayersList.map(gp => gp.user)

      const tournament = await db.query.tournaments.findFirst({
        where: eq(tournaments.id, slot.tournament),
      })

      if (!tournament) {
        return
      }

      const groupMatches = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.session, tournament.session),
            eq(matches.stage, 'group'),
            or(
              inArray(matches.user1, groupUserIds),
              inArray(matches.user2, groupUserIds)
            )
          )
        )

      const allCompleted = groupMatches.every(
        m => m.status === 'completed' && m.winner !== null
      )

      if (!allCompleted) {
        return
      }

      user2 = groupPlayer.user
    }

    if (!user1 || !user2) {
      return
    }

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, slot.tournament),
    })

    if (!tournament) {
      return
    }

    const [newMatch] = await db
      .insert(matches)
      .values({
        user1,
        user2,
        session: tournament.session,
        status: 'planned',
      })
      .returning()

    if (!newMatch) {
      return
    }

    await db
      .update(tournamentMatches)
      .set({ match: newMatch.id })
      .where(eq(tournamentMatches.id, slot.id))
  }
}
