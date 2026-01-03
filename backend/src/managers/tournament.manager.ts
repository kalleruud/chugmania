import type { CreateMatch, Match } from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isEditTournamentRequest,
  isTournamentPreviewRequest,
  type CreateGroup,
  type CreateGroupPlayer,
  type CreateTournament,
  type CreateTournamentMatch,
  type Group,
  type GroupPlayer,
  type GroupWithPlayers,
  type Tournament,
  type TournamentMatch,
  type TournamentWithDetails,
} from '@common/models/tournament'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import loc from '../../../frontend/lib/locales'
import db, { database } from '../../database/database'
import {
  groupPlayers,
  groups,
  matches,
  tournamentMatches,
  tournaments,
  type EliminationType,
  type MatchProgression,
  type TournamentBracket,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'

type TournamentStructure = {
  tournament: Tournament
  groups: Group[]
  groupPlayers: GroupPlayer[]
  tournamentMatches: TournamentMatch[]
  matches: Match[]
}

type UpperMatchMeta = {
  id: string
  round: number
  position: number
}

type LowerMatchMeta = UpperMatchMeta & {
  isDropIn: boolean
}

export default class TournamentManager {
  public static async getAllTournaments(): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))

    return Promise.all(
      tournamentRows.map(t => TournamentManager.getTournamentWithDetails(t.id))
    )
  }

  public static async getTournamentsBySession(
    sessionId: string
  ): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(
        and(eq(tournaments.session, sessionId), isNull(tournaments.deletedAt))
      )

    return Promise.all(
      tournamentRows.map(t => TournamentManager.getTournamentWithDetails(t.id))
    )
  }

  private static async getTournamentWithDetails(
    tournamentId: string
  ): Promise<TournamentWithDetails> {
    const structure =
      await TournamentManager.getTournamentStructure(tournamentId)
    return TournamentManager.toTournamentWithDetails(structure)
  }

  private static async getTournamentStructure(
    tournamentId: string
  ): Promise<TournamentStructure> {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    })

    if (!tournament) {
      throw new Error(loc.no.error.messages.not_in_db(tournamentId))
    }

    const groupRows = await db.query.groups.findMany({
      where: and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)),
    })

    const groupPlayerRows = await db.query.groupPlayers.findMany({
      where: and(
        inArray(
          groupPlayers.group,
          groupRows.map(g => g.id)
        ),
        isNull(groupPlayers.deletedAt)
      ),
    })

    const tournamentMatchRows = await db.query.tournamentMatches.findMany({
      where: and(
        eq(tournamentMatches.tournament, tournamentId),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    const matchRows: Match[] = await Promise.all(
      tournamentMatchRows
        .filter(tm => tm.match)
        .map(async tm => {
          const match = await db.query.matches.findFirst({
            where: and(eq(matches.id, tm.match!), isNull(matches.deletedAt)),
          })
          return match!
        })
    )

    return {
      tournament,
      groups: groupRows,
      groupPlayers: groupPlayerRows,
      tournamentMatches: tournamentMatchRows,
      matches: matchRows,
    }
  }

  private static async toTournamentWithDetails({
    tournament,
    groups,
    groupPlayers,
    tournamentMatches,
    matches,
  }: TournamentStructure): Promise<TournamentWithDetails> {
    const groupMatches = tournamentMatches
      .filter(tm => tm.bracket === 'group')
      .map(tm => matches.find(m => m.id === tm.match))
      .filter(m => m?.winner)

    const groupsWithPlayers: GroupWithPlayers[] = groups.map(group => {
      return {
        ...group,
        players: groupPlayers
          .filter(gp => gp.group === group.id)
          .toSorted((a, b) => b.seed - a.seed)
          .map(gp => ({
            ...gp,
            wins: groupMatches.filter(m => m?.winner === gp.user).length,
            losses: groupMatches.filter(
              m =>
                (m?.user1 === gp.user || m?.user2 === gp.user) &&
                m?.winner !== gp.user
            ).length,
          })),
      }
    })

    return {
      ...tournament,
      groups: groupsWithPlayers,
      matches: tournamentMatches.toSorted(
        (a, b) =>
          (b.round ?? Number.MAX_SAFE_INTEGER) -
          (a.round ?? Number.MAX_SAFE_INTEGER)
      ),
    }
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

    const {
      id: tournamentId,
      groups: groupDrafts,
      groupPlayers: groupPlayerDrafts,
      tournamentMatches: tournamentMatchDrafts,
      matches: matchDrafts,
    } = await TournamentManager.createTournament(
      request.session,
      request.groupsCount,
      request.advancementCount,
      request.eliminationType,
      request.groupStageTracks,
      request.bracketTracks
    )

    const tournamentDraft = {
      id: tournamentId,
      session: request.session,
      name: request.name,
      description: request.description,
      groupsCount: request.groupsCount,
      advancementCount: request.advancementCount,
      eliminationType: request.eliminationType,
    } satisfies CreateTournament

    database.transaction(() => {
      db.insert(tournaments).values(tournamentDraft)
      db.insert(groups).values(groupDrafts)
      db.insert(groupPlayers).values(groupPlayerDrafts)
      db.insert(tournamentMatches).values(tournamentMatchDrafts)
      db.insert(matches).values(matchDrafts)
    })()

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created tournament',
      request.name
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }

  private static async createTournament(
    sessionId: string,
    groupsCount: number,
    advancementCount: number,
    eliminationType: EliminationType,
    groupStageTracks: string[],
    bracketTracks: { stage: string; trackId: string }[]
  ) {
    const tournamentId = randomUUID()

    const playerIds = (await SessionManager.getSessionSignups(sessionId))
      .filter(s => s.response === 'yes')
      .map(s => s.user.id)

    const { groups, groupPlayers } = await TournamentManager.createGroups(
      tournamentId,
      groupsCount,
      playerIds
    )

    const { tournamentMatches, matches } =
      await TournamentManager.createGroupMatches(
        tournamentId,
        sessionId,
        groups,
        groupPlayers,
        groupStageTracks
      )

    const totalAdvancing = groupsCount * advancementCount
    const bracketTournamentMatches = TournamentManager.generateBracketSlots(
      tournamentId,
      groups,
      advancementCount,
      totalAdvancing,
      eliminationType,
      bracketTracks
    )

    return {
      id: tournamentId,
      groups,
      groupPlayers,
      tournamentMatches: [...tournamentMatches, ...bracketTournamentMatches],
      matches,
    }
  }

  private static async createGroups(
    tournamentId: string,
    groupsCount: number,
    playerIds: string[]
  ) {
    // Sort players by rating (descending) - highest rated first
    const sortedPlayers = [...playerIds].sort((a, b) => {
      const ratingA = RatingManager.getUserRatings(a)?.totalRating ?? 0
      const ratingB = RatingManager.getUserRatings(b)?.totalRating ?? 0
      return ratingB - ratingA
    })

    // Generate an ID for relating group players to groups
    const groups: (Omit<CreateGroup, 'id'> & { id: string })[] = Array.from(
      { length: groupsCount },
      (_, i) => ({
        id: randomUUID(),
        name: loc.no.tournament.groupName(String.fromCodePoint(65 + i)),
        tournament: tournamentId,
      })
    )

    // Snake seeding: alternate direction every row
    // Row 0: A B C D (left to right)
    // Row 1: D C B A (right to left)
    // Row 2: A B C D (left to right)
    // etc.
    const groupPlayers: CreateGroupPlayer[] = []
    for (let i = 0; i < sortedPlayers.length; i++) {
      const row = Math.floor(i / groupsCount)
      const positionInRow = i % groupsCount
      const isReverseRow = row % 2 === 1

      const groupIndex = isReverseRow
        ? groupsCount - 1 - positionInRow
        : positionInRow

      const group = groups[groupIndex]

      groupPlayers.push({
        group: group.id,
        user: sortedPlayers[i],
        seed: RatingManager.getUserRatings(sortedPlayers[i])?.totalRating ?? 0,
      })
    }

    return {
      groups,
      groupPlayers,
    }
  }

  private static async createGroupMatches(
    tournamentId: string,
    sessionId: string,
    groups: { id: string; name: string }[],
    groupPlayers: CreateGroupPlayer[],
    groupStageTracks: string[]
  ) {
    const groupWithPlayers = groups.map(group => ({
      ...group,
      players: groupPlayers
        .filter(gp => gp.group === group.id)
        .map(p => p.user),
    }))

    const pairings: {
      group: { id: Group['id']; name: Group['name'] }
      user1: string
      user2: string
    }[] = []

    // TODO: Use a more efficient algorithm for generating group match pairings
    // to avoid players playing back to back matches.
    for (const group of groupWithPlayers) {
      for (let i = 0; i < group.players.length; i++) {
        for (let j = i + 1; j < group.players.length; j++) {
          pairings.push({
            group: { id: group.id, name: group.name },
            user1: group.players[i],
            user2: group.players[j],
          })
        }
      }
    }

    // TODO: Distribute tracks evenly across group matches
    const distributedTracks = TournamentManager.distributeTracksBalanced(
      pairings.length,
      groupStageTracks
    )

    // Create group matches with assigned tracks
    const matches: CreateMatch[] = []
    const tournamentMatches: CreateTournamentMatch[] = []

    for (let i = 0; i < pairings.length; i++) {
      const pairing = pairings[i]
      const trackId = distributedTracks[i]
      const matchId = randomUUID()

      matches.push({
        id: matchId,
        user1: pairing.user1,
        user2: pairing.user2,
        track: trackId,
        session: sessionId,
        stage: 'group',
        status: 'planned',
      })

      tournamentMatches.push({
        tournament: tournamentId,
        name: loc.no.tournament.matchName(pairing.group.name, i + 1),
        bracket: 'group',
        track: trackId,
        match: matchId,
      })
    }

    return { tournamentMatches, matches }
  }

  private static distributeTracksBalanced(
    matchCount: number,
    trackIds: string[]
  ): string[] {
    if (trackIds.length === 0) return []
    if (trackIds.length === 1) return Array(matchCount).fill(trackIds[0])

    const result: string[] = []
    const trackUsage = new Map<string, number>()

    for (const trackId of trackIds) {
      trackUsage.set(trackId, 0)
    }

    for (let i = 0; i < matchCount; i++) {
      let minUsage = Infinity
      let selectedTrack = trackIds[0]

      for (const trackId of trackIds) {
        const usage = trackUsage.get(trackId) ?? 0
        if (usage < minUsage) {
          minUsage = usage
          selectedTrack = trackId
        }
      }

      result.push(selectedTrack)
      trackUsage.set(selectedTrack, (trackUsage.get(selectedTrack) ?? 0) + 1)
    }

    return result
  }

  static generateBracketSlots(
    tournamentId: string,
    createdGroups: { id: string; name: string }[],
    advancementCount: number,
    totalAdvancing: number,
    eliminationType: EliminationType,
    bracketTracks: { stage: string; trackId: string }[]
  ): CreateTournamentMatch[] {
    const trackMap = new Map(bracketTracks.map(b => [b.stage, b.trackId]))
    const bracketSize = 2 ** Math.ceil(Math.log2(totalAdvancing))

    const { matches: upperMatches, meta: upperMeta } =
      TournamentManager.buildUpperBracket(
        tournamentId,
        createdGroups,
        advancementCount,
        totalAdvancing,
        bracketSize,
        trackMap
      )

    const allMatches = [...upperMatches]

    if (eliminationType === 'double') {
      const { matches: lowerMatches, meta: lowerMeta } =
        TournamentManager.buildLowerBracket(
          tournamentId,
          upperMeta,
          bracketSize,
          trackMap
        )

      allMatches.push(...lowerMatches)

      const grandFinal = TournamentManager.buildGrandFinal(
        tournamentId,
        upperMeta,
        lowerMeta,
        trackMap
      )

      if (grandFinal) {
        allMatches.push(grandFinal)
      }
    }

    return allMatches
  }

  private static buildUpperBracket(
    tournamentId: string,
    groups: { id: string }[],
    advancementCount: number,
    totalAdvancing: number,
    bracketSize: number,
    trackMap: Map<string, string>
  ): { matches: CreateTournamentMatch[]; meta: UpperMatchMeta[] } {
    const matches: CreateTournamentMatch[] = []
    const meta: UpperMatchMeta[] = []

    let roundNum = bracketSize

    while (roundNum >= 2) {
      const matchesInRound = roundNum / 2
      const roundName = TournamentManager.getRoundName(roundNum, false)
      const track = trackMap.get(roundName) ?? null

      for (let i = 0; i < matchesInRound; i++) {
        const id = randomUUID()
        const isFirstRound = roundNum === bracketSize

        const draft: CreateTournamentMatch = {
          id,
          tournament: tournamentId,
          name: `${roundName} ${i + 1}`,
          bracket: 'upper',
          round: roundNum,
          track,
        }

        if (isFirstRound) {
          TournamentManager.assignGroupSources(
            draft,
            i,
            groups,
            advancementCount,
            totalAdvancing
          )
        } else {
          TournamentManager.assignWinnerSources(draft, meta, roundNum, i)
        }

        matches.push(draft)
        meta.push({ id, round: roundNum, position: i })
      }

      roundNum /= 2
    }

    return { matches, meta }
  }

  private static assignGroupSources(
    draft: CreateTournamentMatch,
    index: number,
    groups: { id: string }[],
    advancementCount: number,
    totalAdvancing: number
  ) {
    const assign = (
      seed: number,
      set: (groupId: string, rank: number) => void
    ) => {
      if (seed >= totalAdvancing) return

      const groupIndex = seed % groups.length
      const rank = Math.floor(seed / groups.length) + 1

      if (rank <= advancementCount) {
        set(groups[groupIndex].id, rank)
      }
    }

    assign(index * 2, (g, r) => {
      draft.sourceGroupA = g
      draft.sourceGroupARank = r
    })

    assign(index * 2 + 1, (g, r) => {
      draft.sourceGroupB = g
      draft.sourceGroupBRank = r
    })
  }

  private static assignWinnerSources(
    draft: CreateTournamentMatch,
    meta: UpperMatchMeta[],
    roundNum: number,
    index: number
  ) {
    const prev = meta.filter(m => m.round === roundNum * 2)

    if (prev[index * 2]) {
      draft.sourceMatchA = prev[index * 2].id
      draft.sourceMatchAProgression = 'winner'
    }

    if (prev[index * 2 + 1]) {
      draft.sourceMatchB = prev[index * 2 + 1].id
      draft.sourceMatchBProgression = 'winner'
    }
  }

  private static buildLowerBracket(
    tournamentId: string,
    upperMeta: UpperMatchMeta[],
    bracketSize: number,
    trackMap: Map<string, string>
  ): { matches: CreateTournamentMatch[]; meta: LowerMatchMeta[] } {
    const matches: CreateTournamentMatch[] = []
    const meta: LowerMatchMeta[] = []

    const track = trackMap.get('Lower Bracket') ?? null
    let lowerRound = 1

    const firstUpper = upperMeta.filter(m => m.round === bracketSize)
    for (let i = 0; i < Math.floor(firstUpper.length / 2); i++) {
      const id = randomUUID()

      matches.push({
        id,
        tournament: tournamentId,
        name: `Taper Runde ${lowerRound} - ${i + 1}`,
        bracket: 'lower',
        round: lowerRound,
        track,
        sourceMatchA: firstUpper[i * 2].id,
        sourceMatchAProgression: 'loser',
        sourceMatchB: firstUpper[i * 2 + 1].id,
        sourceMatchBProgression: 'loser',
      })

      meta.push({ id, round: lowerRound, position: i, isDropIn: false })
    }

    let upperRound = bracketSize / 2
    lowerRound++

    while (upperRound >= 2) {
      TournamentManager.buildLowerDropInRound(
        tournamentId,
        matches,
        meta,
        upperMeta,
        upperRound,
        lowerRound,
        track
      )

      lowerRound++
      TournamentManager.buildLowerSurvivorRound(
        tournamentId,
        matches,
        meta,
        lowerRound,
        track
      )

      lowerRound++
      upperRound /= 2
    }

    return { matches, meta }
  }

  private static buildLowerDropInRound(
    tournamentId: string,
    matches: CreateTournamentMatch[],
    meta: LowerMatchMeta[],
    upperMeta: UpperMatchMeta[],
    upperRound: number,
    lowerRound: number,
    track: string | null
  ) {
    const prevLower = meta.filter(m => m.round === lowerRound - 1)
    const upperLosers = upperMeta.filter(m => m.round === upperRound)

    const count = Math.min(prevLower.length, upperLosers.length)

    for (let i = 0; i < count; i++) {
      const id = randomUUID()

      matches.push({
        id,
        tournament: tournamentId,
        name: `Taper Runde ${lowerRound} - ${i + 1}`,
        bracket: 'lower',
        round: lowerRound,
        track,
        sourceMatchA: prevLower[i].id,
        sourceMatchAProgression: 'winner',
        sourceMatchB: upperLosers[i].id,
        sourceMatchBProgression: 'loser',
      })

      meta.push({ id, round: lowerRound, position: i, isDropIn: true })
    }
  }

  private static buildLowerSurvivorRound(
    tournamentId: string,
    matches: CreateTournamentMatch[],
    meta: LowerMatchMeta[],
    lowerRound: number,
    track: string | null
  ) {
    const prev = meta.filter(m => m.round === lowerRound - 1)
    if (prev.length <= 1) return

    for (let i = 0; i < Math.floor(prev.length / 2); i++) {
      const id = randomUUID()

      matches.push({
        id,
        tournament: tournamentId,
        name: `Taper Runde ${lowerRound} - ${i + 1}`,
        bracket: 'lower',
        round: lowerRound,
        track,
        sourceMatchA: prev[i * 2].id,
        sourceMatchAProgression: 'winner',
        sourceMatchB: prev[i * 2 + 1].id,
        sourceMatchBProgression: 'winner',
      })

      meta.push({ id, round: lowerRound, position: i, isDropIn: false })
    }
  }

  private static buildGrandFinal(
    tournamentId: string,
    upperMeta: UpperMatchMeta[],
    lowerMeta: LowerMatchMeta[],
    trackMap: Map<string, string>
  ): CreateTournamentMatch | null {
    const upperFinal = upperMeta.find(m => m.round === 2)
    if (!upperFinal) return null

    const lastLowerRound = Math.max(...lowerMeta.map(m => m.round))
    const lowerFinal = lowerMeta.find(m => m.round === lastLowerRound)
    if (!lowerFinal) return null

    return {
      id: randomUUID(),
      tournament: tournamentId,
      name: 'Grand Finale',
      bracket: 'upper',
      round: 1,
      track: trackMap.get('Grand Finale') ?? null,
      sourceMatchA: upperFinal.id,
      sourceMatchAProgression: 'winner',
      sourceMatchB: lowerFinal.id,
      sourceMatchBProgression: 'winner',
    }
  }

  private static getRoundName(size: number, isLower: boolean): string {
    const prefix = isLower ? 'Taper ' : ''
    if (size === 2) return `${prefix}Finale`
    if (size === 4) return `${prefix}Semifinale`
    if (size === 8) return `${prefix}Kvartfinale`
    if (size === 16) return `${prefix}Åttendelsfinale`
    return `${prefix}Runde ${size}`
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

    return { success: false, message: 'Not implemented' }
  }

  private static async deleteTournamentStructure(tournamentId: string) {
    const matchRows = await db
      .select({ matchId: tournamentMatches.match })
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournament, tournamentId))

    for (const row of matchRows) {
      if (row.matchId) {
        await db
          .update(matches)
          .set({ deletedAt: new Date() })
          .where(eq(matches.id, row.matchId))
      }
    }

    await db
      .update(tournamentMatches)
      .set({ deletedAt: new Date() })
      .where(eq(tournamentMatches.tournament, tournamentId))

    const groupRows = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.tournament, tournamentId))

    for (const group of groupRows) {
      await db
        .update(groupPlayers)
        .set({ deletedAt: new Date() })
        .where(eq(groupPlayers.group, group.id))
    }

    await db
      .update(groups)
      .set({ deletedAt: new Date() })
      .where(eq(groups.tournament, tournamentId))
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

    await TournamentManager.deleteTournamentStructure(request.id)

    await db
      .update(tournaments)
      .set({ deletedAt: new Date() })
      .where(eq(tournaments.id, request.id))

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Deleted tournament',
      request.id
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }

  public static async onMatchCompleted(matchId: string) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })

    if (!match || match.status !== 'completed' || !match.winner) {
      return
    }

    const tournamentMatch = await db.query.tournamentMatches.findFirst({
      where: and(
        eq(tournamentMatches.match, matchId),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    if (!tournamentMatch) {
      return
    }

    await db
      .update(tournamentMatches)
      .set({ completedAt: new Date() })
      .where(eq(tournamentMatches.id, tournamentMatch.id))

    if (tournamentMatch.bracket === 'group') {
      await TournamentManager.checkGroupCompletion(
        tournamentMatch.tournament,
        match.session ?? ''
      )
    } else {
      await TournamentManager.progressBracket(
        tournamentMatch.tournament,
        tournamentMatch.id,
        match.winner,
        match.user1 === match.winner ? match.user2 : match.user1,
        match.session ?? ''
      )
    }

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
  }

  private static async checkGroupCompletion(
    tournamentId: string,
    sessionId: string
  ) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    })

    if (!tournament) return

    const groupRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))

    for (const group of groupRows) {
      const groupMatchRows = await db
        .select()
        .from(tournamentMatches)
        .innerJoin(matches, eq(tournamentMatches.match, matches.id))
        .where(
          and(
            eq(tournamentMatches.tournament, tournamentId),
            eq(tournamentMatches.bracket, 'group'),
            isNull(tournamentMatches.deletedAt)
          )
        )

      const playerRows = await db
        .select()
        .from(groupPlayers)
        .where(
          and(eq(groupPlayers.group, group.id), isNull(groupPlayers.deletedAt))
        )

      const relevantMatches = groupMatchRows.filter(gm => {
        const playerIds = playerRows.map(p => p.user)
        return (
          playerIds.includes(gm.matches.user1 ?? '') ||
          playerIds.includes(gm.matches.user2 ?? '')
        )
      })

      const allCompleted = relevantMatches.every(
        gm => gm.matches.status === 'completed'
      )

      if (!allCompleted) continue

      const standings = TournamentManager.calculateGroupStandings(
        playerRows,
        relevantMatches.map(r => r.matches)
      )

      for (let rank = 1; rank <= tournament.advancementCount; rank++) {
        const player = standings[rank - 1]
        if (!player) continue

        const pendingMatches = await db
          .select()
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournament, tournamentId),
              eq(tournamentMatches.sourceGroupA, group.id),
              eq(tournamentMatches.sourceGroupARank, rank),
              isNull(tournamentMatches.match),
              isNull(tournamentMatches.deletedAt)
            )
          )

        for (const pending of pendingMatches) {
          await TournamentManager.tryCreateBracketMatch(
            pending,
            sessionId,
            player.user
          )
        }

        const pendingMatchesB = await db
          .select()
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournament, tournamentId),
              eq(tournamentMatches.sourceGroupB, group.id),
              eq(tournamentMatches.sourceGroupBRank, rank),
              isNull(tournamentMatches.match),
              isNull(tournamentMatches.deletedAt)
            )
          )

        for (const pending of pendingMatchesB) {
          await TournamentManager.tryCreateBracketMatch(
            pending,
            sessionId,
            undefined,
            player.user
          )
        }
      }
    }
  }

  private static calculateGroupStandings(
    players: { user: string }[],
    groupMatches: {
      user1: string | null
      user2: string | null
      winner: string | null
    }[]
  ): { user: string; wins: number; losses: number }[] {
    const stats = new Map<string, { wins: number; losses: number }>()

    for (const player of players) {
      stats.set(player.user, { wins: 0, losses: 0 })
    }

    for (const match of groupMatches) {
      if (!match.winner) continue

      const winnerStats = stats.get(match.winner)
      if (winnerStats) {
        winnerStats.wins++
      }

      const loser = match.user1 === match.winner ? match.user2 : match.user1
      if (loser) {
        const loserStats = stats.get(loser)
        if (loserStats) {
          loserStats.losses++
        }
      }
    }

    return Array.from(stats.entries())
      .map(([user, s]) => ({ user, ...s }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return a.losses - b.losses
      })
  }

  private static async progressBracket(
    tournamentId: string,
    completedMatchId: string,
    winnerId: string,
    loserId: string | null,
    sessionId: string
  ) {
    const downstreamWinner = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.sourceMatchA, completedMatchId),
          eq(tournamentMatches.sourceMatchAProgression, 'winner'),
          isNull(tournamentMatches.match),
          isNull(tournamentMatches.deletedAt)
        )
      )

    for (const pending of downstreamWinner) {
      await TournamentManager.tryCreateBracketMatch(
        pending,
        sessionId,
        winnerId
      )
    }

    const downstreamWinnerB = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.sourceMatchB, completedMatchId),
          eq(tournamentMatches.sourceMatchBProgression, 'winner'),
          isNull(tournamentMatches.match),
          isNull(tournamentMatches.deletedAt)
        )
      )

    for (const pending of downstreamWinnerB) {
      await TournamentManager.tryCreateBracketMatch(
        pending,
        sessionId,
        undefined,
        winnerId
      )
    }

    if (loserId) {
      const downstreamLoser = await db
        .select()
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournament, tournamentId),
            eq(tournamentMatches.sourceMatchA, completedMatchId),
            eq(tournamentMatches.sourceMatchAProgression, 'loser'),
            isNull(tournamentMatches.match),
            isNull(tournamentMatches.deletedAt)
          )
        )

      for (const pending of downstreamLoser) {
        await TournamentManager.tryCreateBracketMatch(
          pending,
          sessionId,
          loserId
        )
      }

      const downstreamLoserB = await db
        .select()
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournament, tournamentId),
            eq(tournamentMatches.sourceMatchB, completedMatchId),
            eq(tournamentMatches.sourceMatchBProgression, 'loser'),
            isNull(tournamentMatches.match),
            isNull(tournamentMatches.deletedAt)
          )
        )

      for (const pending of downstreamLoserB) {
        await TournamentManager.tryCreateBracketMatch(
          pending,
          sessionId,
          undefined,
          loserId
        )
      }
    }
  }

  private static async tryCreateBracketMatch(
    pendingMatch: typeof tournamentMatches.$inferSelect,
    sessionId: string,
    userA?: string,
    userB?: string
  ) {
    let resolvedUserA = userA
    let resolvedUserB = userB

    if (
      !resolvedUserA &&
      pendingMatch.sourceGroupA &&
      pendingMatch.sourceGroupARank
    ) {
      resolvedUserA = await TournamentManager.getGroupRankedPlayer(
        pendingMatch.sourceGroupA,
        pendingMatch.sourceGroupARank,
        pendingMatch.tournament
      )
    }

    if (
      !resolvedUserA &&
      pendingMatch.sourceMatchA &&
      pendingMatch.sourceMatchAProgression
    ) {
      resolvedUserA = await TournamentManager.getMatchProgressedPlayer(
        pendingMatch.sourceMatchA,
        pendingMatch.sourceMatchAProgression
      )
    }

    if (
      !resolvedUserB &&
      pendingMatch.sourceGroupB &&
      pendingMatch.sourceGroupBRank
    ) {
      resolvedUserB = await TournamentManager.getGroupRankedPlayer(
        pendingMatch.sourceGroupB,
        pendingMatch.sourceGroupBRank,
        pendingMatch.tournament
      )
    }

    if (
      !resolvedUserB &&
      pendingMatch.sourceMatchB &&
      pendingMatch.sourceMatchBProgression
    ) {
      resolvedUserB = await TournamentManager.getMatchProgressedPlayer(
        pendingMatch.sourceMatchB,
        pendingMatch.sourceMatchBProgression
      )
    }

    if (!resolvedUserA || !resolvedUserB) {
      return
    }

    const stage = TournamentManager.getBracketStage(
      pendingMatch.bracket as TournamentBracket,
      pendingMatch.round
    )

    const [newMatch] = await db
      .insert(matches)
      .values({
        user1: resolvedUserA,
        user2: resolvedUserB,
        track: pendingMatch.track,
        session: sessionId,
        stage,
        status: 'planned',
      })
      .returning()

    await db
      .update(tournamentMatches)
      .set({ match: newMatch.id })
      .where(eq(tournamentMatches.id, pendingMatch.id))

    await RatingManager.recalculate()
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_rankings', await RatingManager.onGetRatings())
  }

  private static async getGroupRankedPlayer(
    groupId: string,
    rank: number,
    tournamentId: string
  ): Promise<string | undefined> {
    const playerRows = await db
      .select()
      .from(groupPlayers)
      .where(
        and(eq(groupPlayers.group, groupId), isNull(groupPlayers.deletedAt))
      )

    const groupMatchRows = await db
      .select()
      .from(tournamentMatches)
      .innerJoin(matches, eq(tournamentMatches.match, matches.id))
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.bracket, 'group'),
          isNull(tournamentMatches.deletedAt)
        )
      )

    const playerIds = playerRows.map(p => p.user)
    const relevantMatches = groupMatchRows.filter(
      gm =>
        playerIds.includes(gm.matches.user1 ?? '') ||
        playerIds.includes(gm.matches.user2 ?? '')
    )

    const allCompleted = relevantMatches.every(
      gm => gm.matches.status === 'completed'
    )

    if (!allCompleted) return undefined

    const standings = TournamentManager.calculateGroupStandings(
      playerRows,
      relevantMatches.map(r => r.matches)
    )

    return standings[rank - 1]?.user
  }

  private static async getMatchProgressedPlayer(
    matchId: string,
    progression: MatchProgression
  ): Promise<string | undefined> {
    const tm = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.id, matchId),
    })

    if (!tm?.match || !tm.completedAt) return undefined

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, tm.match),
    })

    if (!match?.winner) return undefined

    if (progression === 'winner') {
      return match.winner
    } else {
      return match.user1 === match.winner
        ? (match.user2 ?? undefined)
        : (match.user1 ?? undefined)
    }
  }

  private static getBracketStage(
    bracket: TournamentBracket,
    round: number
  ): string {
    if (bracket === 'group') return 'group'

    if (bracket === 'lower') {
      // Lower bracket uses sequential round numbers
      return 'group' // Use 'group' as generic stage for lower bracket matches
    }

    // Upper bracket uses bitwise round numbers
    if (round === 1) return 'grand_final'
    if (round === 2) return 'final'
    if (round === 4) return 'semi'
    if (round === 8) return 'quarter'
    if (round === 16) return 'eight'

    return 'group'
  }

  static async onGetTournamentPreview(
    socket: TypedSocket,
    request: EventReq<'get_tournament_preview'>
  ): Promise<EventRes<'get_tournament_preview'>> {
    if (!isTournamentPreviewRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('GetTournamentPreviewRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const {
      id: tournamentId,
      groups,
      groupPlayers,
      tournamentMatches,
      matches,
    } = await TournamentManager.createTournament(
      request.session,
      request.groupsCount,
      request.advancementCount,
      request.eliminationType,
      request.groupStageTracks,
      request.bracketTracks
    )

    const tournamentDraft = {
      id: tournamentId,
      session: request.session,
      name: request.name,
      description: request.description,
      groupsCount: request.groupsCount,
      advancementCount: request.advancementCount,
      eliminationType: request.eliminationType,
    } satisfies CreateTournament

    const tournamentWithDetails =
      await TournamentManager.toTournamentWithDetails({
        tournament: tournamentDraft as Tournament,
        groups: groups as Group[],
        groupPlayers: groupPlayers as GroupPlayer[],
        tournamentMatches: tournamentMatches as TournamentMatch[],
        matches: matches as Match[],
      })

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created tournament preview of:',
      request.name
    )

    return { success: true, tournament: tournamentWithDetails }
  }
}
