import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  type TournamentData,
} from '@common/models/tournament'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { and, asc, eq, isNull, getTableColumns } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import {
  groupPlayers,
  groups,
  matches,
  sessionSignups,
  tournamentMatches,
  tournaments,
  users,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import UserManager from './user.manager'
import MatchManager from './match.manager'

export default class TournamentManager {

  public static async getAllTournaments(): Promise<TournamentData[]> {
      const tournamentRows = await db
        .select()
        .from(tournaments)
        .where(isNull(tournaments.deletedAt))
      
      return await TournamentManager.enrichTournaments(tournamentRows)
  }

  public static async getTournamentsForSession(
    sessionId: string
  ): Promise<TournamentData[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(
        and(
          eq(tournaments.session, sessionId),
          isNull(tournaments.deletedAt)
        )
      )
    return await TournamentManager.enrichTournaments(tournamentRows)
  }

  private static async enrichTournaments(tournamentRows: typeof tournaments.$inferSelect[]): Promise<TournamentData[]> {
    const result: TournamentData[] = []
    for (const t of tournamentRows) {
      const groupRows = await db
        .select()
        .from(groups)
        .where(
          and(
            eq(groups.tournament, t.id),
            isNull(groups.deletedAt)
          )
        )

      const groupsWithPlayers = await Promise.all(
        groupRows.map(async g => {
          const players = await db
            .select({
              ...getTableColumns(groupPlayers),
              userData: users
            })
            .from(groupPlayers)
            .innerJoin(users, eq(groupPlayers.user, users.id))
            .where(
              and(
                eq(groupPlayers.group, g.id),
                isNull(groupPlayers.deletedAt)
              )
            )
            .orderBy(asc(groupPlayers.seed))
          
          return {
            ...g,
            players: players.map(p => ({
              ...p,
              user: UserManager.toUserInfo(p.userData).userInfo,
            })),
          }
        })
      )

      const matchRows = await db
        .select({
          ...tournamentMatches,
          matchData: matches
        })
        .from(tournamentMatches)
        .leftJoin(matches, eq(tournamentMatches.match, matches.id))
        .where(
          and(
            eq(tournamentMatches.tournament, t.id),
            isNull(tournamentMatches.deletedAt)
          )
        )
        .orderBy(asc(tournamentMatches.round))

      result.push({
        ...t,
        groups: groupsWithPlayers,
        matches: matchRows,
      })
    }
    return result
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

    const { type, createdAt, updatedAt, deletedAt, ...data } = request

    // 1. Create Tournament
    const [insertedTournament] = await db
      .insert(tournaments)
      .values(data)
      .returning()

    if (!insertedTournament) throw new Error('Failed to create tournament')

    // 2. Fetch Players (Response = 'yes')
    const players = await db
      .select({ id: sessionSignups.user })
      .from(sessionSignups)
      .where(
        and(
          eq(sessionSignups.session, data.session),
          eq(sessionSignups.response, 'yes'),
          isNull(sessionSignups.deletedAt)
        )
      )
    
    // Shuffle players for random seeding
    const shuffledPlayers = players.sort(() => Math.random() - 0.5)

    // 3. Create Groups and GroupPlayers
    const groupIds: string[] = []
    for (let i = 0; i < data.groupsCount; i++) {
      const [group] = await db
        .insert(groups)
        .values({
          tournament: insertedTournament.id,
          name: `Group ${String.fromCharCode(65 + i)}`,
        })
        .returning()
      groupIds.push(group.id)
    }

    // Distribute players
    for (let i = 0; i < shuffledPlayers.length; i++) {
      const groupIndex = i % data.groupsCount
      await db.insert(groupPlayers).values({
        group: groupIds[groupIndex],
        user: shuffledPlayers[i].id,
        seed: Math.floor(i / data.groupsCount) + 1,
      })
    }

    // 4. Create Group Matches (Round Robin)
    for (const groupId of groupIds) {
        const gp = await db.select().from(groupPlayers).where(eq(groupPlayers.group, groupId))
        for (let i = 0; i < gp.length; i++) {
            for (let j = i + 1; j < gp.length; j++) {
                const matchId = await MatchManager.createMatchInternal({
                    user1: gp[i].user,
                    user2: gp[j].user,
                    session: data.session,
                    stage: 'group',
                    status: 'planned'
                })

                await db.insert(tournamentMatches).values({
                    tournament: insertedTournament.id,
                    name: `Group Match`,
                    bracket: 'group',
                    round: 0,
                    match: matchId,
                })
            }
        }
    }

    // 5. Generate Bracket Slots
    await TournamentManager.generateBracket(
      insertedTournament.id, 
      data.groupsCount, 
      data.advancementCount, 
      data.eliminationType
    )

    // Broadcast
    broadcast('all_tournaments', await TournamentManager.getAllTournaments())

    return { success: true }
  }

  static async generateBracket(
    tournamentId: string,
    groupsCount: number,
    advancementCount: number,
    _eliminationType: 'single' | 'double'
  ) {
    const totalQualifiers = groupsCount * advancementCount
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalQualifiers)))
    
    // Helper to get group source
    const getSeedSource = async (seed: number) => {
      if (seed > totalQualifiers) return null
      
      const rank = Math.ceil(seed / groupsCount)
      const groupIdx = (seed - 1) % groupsCount
      const tournamentGroups = await db
        .select()
        .from(groups)
        .where(eq(groups.tournament, tournamentId))
        .orderBy(asc(groups.name))
      
      const group = tournamentGroups[groupIdx]
      return { groupId: group.id, rank }
    }

    const layers: string[][] = []

    const seedPairs = TournamentManager.getBracketPairings(bracketSize)
    const firstRoundIds: string[] = []
    
    // Create First Round Matches
    for (let i = 0; i < seedPairs.length; i++) {
        const [seedA, seedB] = seedPairs[i]
        const sourceA = await getSeedSource(seedA)
        const sourceB = await getSeedSource(seedB)

        let matchId = null
        
        if (sourceA && sourceB) {
             const [m] = await db.insert(tournamentMatches).values({
                tournament: tournamentId,
                name: `Round of ${bracketSize} - Match ${i+1}`,
                bracket: 'upper',
                round: bracketSize / 2, 
                sourceGroupA: sourceA.groupId,
                sourceGroupARank: sourceA.rank,
                sourceGroupB: sourceB.groupId,
                sourceGroupBRank: sourceB.rank,
             }).returning()
             matchId = m.id
        } else if (sourceA) {
             matchId = `BYE:${sourceA.groupId}:${sourceA.rank}`
        } else {
             if (sourceB) matchId = `BYE:${sourceB.groupId}:${sourceB.rank}`
             else matchId = `BYE:NULL`
        }
        firstRoundIds.push(matchId)
    }
    layers.push(firstRoundIds)

    // Generate Subsequent Rounds
    let currentRoundSize = bracketSize / 2
    while (currentRoundSize > 1) {
        const prevLayer = layers[layers.length - 1]
        const nextLayer: string[] = []
        
        for (let i = 0; i < prevLayer.length; i += 2) {
            const left = prevLayer[i]
            const right = prevLayer[i+1]
            
            const roundVal = currentRoundSize / 2 
            
            const payload: any = {
                tournament: tournamentId,
                name: roundVal === 1 ? "Final" : (roundVal === 2 ? "Semi-Final" : `Round of ${currentRoundSize}`),
                bracket: 'upper',
                round: roundVal
            }
            
            if (left.startsWith('BYE:')) {
                const parts = left.split(':')
                if (parts[1] !== 'NULL') {
                    payload.sourceGroupA = parts[1]
                    payload.sourceGroupARank = parseInt(parts[2])
                }
            } else {
                payload.sourceMatchA = left
                payload.sourceMatchAProgression = 'winner'
            }
            
            if (right.startsWith('BYE:')) {
                const parts = right.split(':')
                if (parts[1] !== 'NULL') {
                    payload.sourceGroupB = parts[1]
                    payload.sourceGroupBRank = parseInt(parts[2])
                }
            } else {
                payload.sourceMatchB = right
                payload.sourceMatchBProgression = 'winner'
            }
            
            const [m] = await db.insert(tournamentMatches).values(payload).returning()
            nextLayer.push(m.id)
        }
        layers.push(nextLayer)
        currentRoundSize /= 2
    }
  }

  private static getBracketPairings(n: number): [number, number][] {
      let seeds = [1, 2]
      for (let size = 2; size < n; size *= 2) {
          const nextSeeds: number[] = []
          for (let i = 0; i < seeds.length; i++) {
              nextSeeds.push(seeds[i])
              nextSeeds.push((size * 2 + 1) - seeds[i])
          }
          seeds = nextSeeds
      }
      const res: [number, number][] = []
      for (let i = 0; i < seeds.length; i+=2) {
          res.push([seeds[i], seeds[i+1]])
      }
      return res
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

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const [tournament] = await db
      .update(tournaments)
      .set({ deletedAt: new Date() })
      .where(eq(tournaments.id, request.id))
      .returning()

    if (tournament) {
        broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    }

    return {
      success: true,
    }
  }

  static async onMatchCompleted(matchId: string) {
      const tMatches = await db.select().from(tournamentMatches).where(eq(tournamentMatches.match, matchId))
      
      // Also check if match is part of a group but not directly linked in tournamentMatches (wait, my code links them!)
      // My code links group matches in tournamentMatches with bracket='group'.
      // So checking tMatches is enough!
      
      if (tMatches.length === 0) return

      for (const tm of tMatches) {
          if (tm.bracket === 'group') {
              const groupsInTournament = await db.select().from(groups).where(eq(groups.tournament, tm.tournament))
              
              for (const g of groupsInTournament) {
                  await TournamentManager.checkGroupCompletion(g.id, tm.tournament)
              }
              
          } else {
              await TournamentManager.resolveDownstreamMatches(tm.id, matchId)
          }
      }
  }

  private static async checkGroupCompletion(groupId: string, tournamentId: string) {
      const players = await db.select().from(groupPlayers).where(eq(groupPlayers.group, groupId))
      const playerIds = players.map(p => p.user)
      
      const groupStageMatches = await db.select({
          tm: tournamentMatches,
          m: matches
      })
      .from(tournamentMatches)
      .innerJoin(matches, eq(tournamentMatches.match, matches.id))
      .where(and(eq(tournamentMatches.tournament, tournamentId), eq(tournamentMatches.bracket, 'group')))
      
      const relevantMatches = groupStageMatches.filter(row => 
          playerIds.includes(row.m.user1!) && playerIds.includes(row.m.user2!)
      )
      
      const allCompleted = relevantMatches.every(row => row.m.status === 'completed')
      
      if (allCompleted) {
          const standings = await TournamentManager.calculateGroupStandings(relevantMatches.map(r => r.m), playerIds)
          
          for (let i = 0; i < standings.length; i++) {
              // const userId = standings[i]
              const rank = i + 1
              
              const slots = await db.select().from(tournamentMatches).where(and(
                  eq(tournamentMatches.tournament, tournamentId),
              ))
              
              for (const slot of slots) {
                  let updated = false
                  if (slot.sourceGroupA === groupId && slot.sourceGroupARank === rank) {
                      updated = true
                  }
                  if (slot.sourceGroupB === groupId && slot.sourceGroupBRank === rank) {
                      updated = true
                  }
                  
                  if (updated) {
                      await TournamentManager.checkSlotReadiness(slot)
                  }
              }
          }
      }
  }
  
  private static async calculateGroupStandings(matchList: any[], playerIds: string[]): Promise<string[]> {
      const scores: Record<string, number> = {}
      playerIds.forEach(id => scores[id] = 0)
      
      for (const m of matchList) {
          if (m.winner) {
              scores[m.winner]++
          }
      }
      
      return Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .map(([id]) => id)
  }

  private static async resolveDownstreamMatches(upstreamTmId: string, matchId: string) {
      const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId)})
      if (!match || !match.winner) return

      const dependentSlots = await db.select().from(tournamentMatches).where(
          and(
              isNull(tournamentMatches.deletedAt)
          )
      )
      const relevant = dependentSlots.filter(s => s.sourceMatchA === upstreamTmId || s.sourceMatchB === upstreamTmId)
      
      for (const slot of relevant) {
          await TournamentManager.checkSlotReadiness(slot)
      }
  }

  private static async checkSlotReadiness(slot: typeof tournamentMatches.$inferSelect) {
      let userA: string | null = null
      
      if (slot.sourceGroupA) {
          userA = await TournamentManager.getResolvedGroupUser(slot.sourceGroupA, slot.sourceGroupARank!)
      } else if (slot.sourceMatchA) {
          userA = await TournamentManager.getResolvedMatchUser(slot.sourceMatchA, slot.sourceMatchAProgression!)
      }
      
      let userB: string | null = null
      if (slot.sourceGroupB) {
          userB = await TournamentManager.getResolvedGroupUser(slot.sourceGroupB, slot.sourceGroupBRank!)
      } else if (slot.sourceMatchB) {
          userB = await TournamentManager.getResolvedMatchUser(slot.sourceMatchB, slot.sourceMatchBProgression!)
      }
      
      if (userA && userB) {
          if (!slot.match) {
              const tournament = await db.query.tournaments.findFirst({where: eq(tournaments.id, slot.tournament)})
              
              const matchId = await MatchManager.createMatchInternal({
                  user1: userA,
                  user2: userB,
                  session: tournament!.session,
                  stage: 'quarter', 
                  status: 'planned'
              })
              
              await db.update(tournamentMatches)
                  .set({ match: matchId })
                  .where(eq(tournamentMatches.id, slot.id))
              
               broadcast('all_tournaments', await TournamentManager.getAllTournaments())
          }
      }
  }
  
  private static async getResolvedGroupUser(groupId: string, rank: number): Promise<string | null> {
      const players = await db.select().from(groupPlayers).where(eq(groupPlayers.group, groupId))
      const playerIds = players.map(p => p.user)
      
      const groupStageMatches = await db.select({
          tm: tournamentMatches,
          m: matches
      })
      .from(tournamentMatches)
      .innerJoin(matches, eq(tournamentMatches.match, matches.id))
      .where(and(eq(tournamentMatches.bracket, 'group')))
      
      const group = await db.query.groups.findFirst({where: eq(groups.id, groupId)})
      if (!group) return null

      const relevantMatches = groupStageMatches.filter(row => 
           row.tm.tournament === group.tournament &&
          playerIds.includes(row.m.user1!) && playerIds.includes(row.m.user2!)
      )
       const allCompleted = relevantMatches.every(row => row.m.status === 'completed')
       
       if (!allCompleted) return null
       
       const standings = await TournamentManager.calculateGroupStandings(relevantMatches.map(r => r.m), playerIds)
       return standings[rank - 1] || null
  }

  private static async getResolvedMatchUser(tmId: string, progression: 'winner' | 'loser'): Promise<string | null> {
      const tm = await db.query.tournamentMatches.findFirst({where: eq(tournamentMatches.id, tmId)})
      if (!tm || !tm.match) return null
      
      const match = await db.query.matches.findFirst({where: eq(matches.id, tm.match)})
      if (!match || match.status !== 'completed' || !match.winner) return null
      
      if (progression === 'winner') return match.winner
      return match.winner === match.user1 ? match.user2 : match.user1
  }
}
