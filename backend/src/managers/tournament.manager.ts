import type { CreateMatch, Match } from '@common/models/match'
import type { EventRes } from '@common/models/socket.io'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isEditTournamentRequest,
  isTournamentPreviewRequest,
  type CreateGroup,
  type CreateGroupPlayer,
  type CreateTournament,
  type CreateTournamentMatch,
  type CreateTournamentRequest,
  type DeleteTournamentRequest,
  type EditTournamentRequest,
  type Group,
  type GroupPlayer,
  type GroupWithPlayers,
  type Tournament,
  type TournamentMatch,
  type TournamentPreviewRequest,
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
  type MatchStage,
  type TournamentBracket,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../socket'
import AuthManager from './auth.manager'
import { getAllMatches } from './match.queries'
import RatingManager from './rating.manager'
import { getSessionSignups } from './session.queries'

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

class TournamentManagerClass {
  public async getAllTournaments(): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))

    return Promise.all(
      tournamentRows.map(t => TournamentManager.getTournamentWithDetails(t.id))
    )
  }

  public async getTournamentsBySession(
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

  private async getTournamentWithDetails(
    tournamentId: string
  ): Promise<TournamentWithDetails> {
    const structure =
      await TournamentManager.getTournamentStructure(tournamentId)
    return TournamentManager.toTournamentWithDetails(structure)
  }

  private async getTournamentStructure(
    tournamentId: string
  ): Promise<TournamentStructure> {
    const [tournament, groupRows, tournamentMatchRows] = await Promise.all([
      db.query.tournaments.findFirst({
        where: eq(tournaments.id, tournamentId),
      }),
      db.query.groups.findMany({
        where: and(
          eq(groups.tournament, tournamentId),
          isNull(groups.deletedAt)
        ),
      }),
      db.query.tournamentMatches.findMany({
        where: and(
          eq(tournamentMatches.tournament, tournamentId),
          isNull(tournamentMatches.deletedAt)
        ),
      }),
    ])

    if (!tournament) {
      throw new Error(loc.no.error.messages.not_in_db(tournamentId))
    }

    const groupPlayerRows = await db.query.groupPlayers.findMany({
      where: and(
        inArray(
          groupPlayers.group,
          groupRows.map(g => g.id)
        ),
        isNull(groupPlayers.deletedAt)
      ),
    })

    const matchRows = (
      await Promise.all(
        tournamentMatchRows.map(async tm => {
          if (!tm.match) return null
          return await db.query.matches.findFirst({
            where: and(eq(matches.id, tm.match), isNull(matches.deletedAt)),
          })
        })
      )
    ).filter(match => match !== null && match !== undefined)

    return {
      tournament,
      groups: groupRows,
      groupPlayers: groupPlayerRows,
      tournamentMatches: tournamentMatchRows,
      matches: matchRows,
    }
  }

  private toTournamentWithDetails({
    tournament,
    groups,
    groupPlayers,
    tournamentMatches,
    matches,
  }: TournamentStructure): TournamentWithDetails {
    const matchById = new Map(matches.map(match => [match.id, match]))
    const groupMatches: Match[] = []
    for (const tm of tournamentMatches) {
      if (tm.bracket !== 'group') continue
      const match = tm.match ? matchById.get(tm.match) : undefined
      if (match?.winner !== undefined) groupMatches.push(match)
    }

    const groupsWithPlayers: GroupWithPlayers[] = groups.map(group => {
      return {
        ...group,
        players: groupPlayers
          .reduce<typeof groupPlayers>((players, gp) => {
            if (gp.group === group.id) players.push(gp)
            return players
          }, [])
          .toSorted((a, b) => b.seed - a.seed)
          .map(gp => ({
            ...gp,
            wins: groupMatches.filter(m => m.winner === gp.user).length,
            losses: groupMatches.filter(
              m =>
                (m.user1 === gp.user || m.user2 === gp.user) &&
                m.winner !== gp.user
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

  async onCreateTournament(
    socket: TypedSocket,
    request: CreateTournamentRequest
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
      request.eliminationType
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
      db.insert(tournaments).values(tournamentDraft).run()
      db.insert(groups).values(groupDrafts).run()
      db.insert(groupPlayers).values(groupPlayerDrafts).run()
      db.insert(matches).values(matchDrafts).run()
      db.insert(tournamentMatches).values(tournamentMatchDrafts).run()
    })()

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created tournament',
      request.name
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await getAllMatches())

    return { success: true }
  }

  private async createTournament(
    sessionId: string,
    groupsCount: number,
    advancementCount: number,
    eliminationType: EliminationType
  ) {
    const tournamentId = randomUUID()

    const playerIds = (await getSessionSignups(sessionId)).reduce<string[]>(
      (ids, signup) => {
        if (signup.response === 'yes') ids.push(signup.user.id)
        return ids
      },
      []
    )

    const { groups, groupPlayers } = TournamentManager.createGroups(
      tournamentId,
      groupsCount,
      playerIds
    )

    const { tournamentMatches, matches } = TournamentManager.createGroupMatches(
      tournamentId,
      sessionId,
      groups,
      groupPlayers
    )

    const totalAdvancing = groupsCount * advancementCount
    const bracketTournamentMatches = TournamentManager.generateBracketSlots(
      tournamentId,
      groups,
      advancementCount,
      totalAdvancing,
      eliminationType
    )

    return {
      id: tournamentId,
      groups,
      groupPlayers,
      tournamentMatches: [...tournamentMatches, ...bracketTournamentMatches],
      matches,
    }
  }

  private createGroups(
    tournamentId: string,
    groupsCount: number,
    playerIds: string[]
  ) {
    // Sort players by rating (descending) - highest rated first
    const sortedPlayers = playerIds.toSorted((a, b) => {
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

  private createGroupMatches(
    tournamentId: string,
    sessionId: string,
    groups: { id: string; name: string }[],
    groupPlayers: CreateGroupPlayer[]
  ) {
    const groupWithPlayers = groups.map(group => {
      const players: string[] = []
      for (const groupPlayer of groupPlayers) {
        if (groupPlayer.group === group.id) players.push(groupPlayer.user)
      }
      return { ...group, players }
    })

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

    // Create group matches with assigned tracks
    const matches: CreateMatch[] = []
    const tournamentMatches: CreateTournamentMatch[] = []

    for (let i = 0; i < pairings.length; i++) {
      const pairing = pairings[i]
      const matchId = randomUUID()

      matches.push({
        id: matchId,
        user1: pairing.user1,
        user2: pairing.user2,
        session: sessionId,
        stage: 'group',
        status: 'planned',
      })

      const matchNumber = (i % groups.length) + 1

      tournamentMatches.push({
        tournament: tournamentId,
        name: loc.no.tournament.matchName(pairing.group.name, matchNumber),
        bracket: 'group',
        match: matchId,
      })
    }

    return { tournamentMatches, matches }
  }

  generateBracketSlots(
    tournamentId: string,
    createdGroups: { id: string; name: string }[],
    advancementCount: number,
    totalAdvancing: number,
    eliminationType: EliminationType,
    bracketTracks: { stage: string; trackId: string }[] = []
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

  private buildUpperBracket(
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

  private assignGroupSources(
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

  private assignWinnerSources(
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

  private buildLowerBracket(
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
        name: `${TournamentManager.getRoundName(lowerRound, true)} - ${i + 1}`,
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

  private buildLowerDropInRound(
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

  private buildLowerSurvivorRound(
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

  private buildGrandFinal(
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

  private getRoundName(size: number, isLower: boolean): string {
    const prefix = isLower ? 'Taper ' : ''
    if (size === 2) return `${prefix}Finale`
    if (size === 4) return `${prefix}Semifinale`
    if (size === 8) return `${prefix}Kvartfinale`
    if (size === 16) return `${prefix}Åttendelsfinale`
    return `${prefix}Runde ${size}`
  }

  onEditTournament(
    socket: TypedSocket,
    request: EditTournamentRequest
  ): EventRes<'edit_tournament'> {
    if (!isEditTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('EditTournamentRequest')
      )
    }

    console.log(
      new Date().toISOString(),
      socket.id,
      'Edited tournament',
      request.id
    )

    return { success: false, message: 'Not implemented' }
  }

  private async deleteTournamentStructure(tournamentId: string) {
    const [matchRows, groupRows] = await Promise.all([
      db
        .select({ matchId: tournamentMatches.match })
        .from(tournamentMatches)
        .where(eq(tournamentMatches.tournament, tournamentId)),
      db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.tournament, tournamentId)),
    ])

    const deletedAt = new Date()
    await Promise.all([
      ...matchRows.map(row =>
        row.matchId
          ? db
              .update(matches)
              .set({ deletedAt })
              .where(eq(matches.id, row.matchId))
          : Promise.resolve()
      ),
      db
        .update(tournamentMatches)
        .set({ deletedAt })
        .where(eq(tournamentMatches.tournament, tournamentId)),
      ...groupRows.map(group =>
        db
          .update(groupPlayers)
          .set({ deletedAt })
          .where(eq(groupPlayers.group, group.id))
      ),
      db
        .update(groups)
        .set({ deletedAt })
        .where(eq(groups.tournament, tournamentId)),
    ])
  }

  async onDeleteTournament(
    socket: TypedSocket,
    request: DeleteTournamentRequest
  ): Promise<EventRes<'delete_tournament'>> {
    if (!isDeleteTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DeleteTournamentRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const deletedAt = new Date()
    await Promise.all([
      TournamentManager.deleteTournamentStructure(request.id),
      db
        .update(tournaments)
        .set({ deletedAt })
        .where(eq(tournaments.id, request.id)),
    ])

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Deleted tournament',
      request.id
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await getAllMatches())

    return { success: true }
  }

  public async onMatchCompleted(matchId: string) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })

    if (match?.status !== 'completed' || !match.winner) {
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

  private async checkGroupCompletion(tournamentId: string, sessionId: string) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    })

    if (!tournament) return

    const groupRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))

    await Promise.all(
      groupRows.map(async group => {
        const [groupMatchRows, playerRows] = await Promise.all([
          db
            .select()
            .from(tournamentMatches)
            .innerJoin(matches, eq(tournamentMatches.match, matches.id))
            .where(
              and(
                eq(tournamentMatches.tournament, tournamentId),
                eq(tournamentMatches.bracket, 'group'),
                isNull(tournamentMatches.deletedAt)
              )
            ),
          db
            .select()
            .from(groupPlayers)
            .where(
              and(
                eq(groupPlayers.group, group.id),
                isNull(groupPlayers.deletedAt)
              )
            ),
        ])

        const relevantMatches = groupMatchRows.filter(gm => {
          const playerIds = new Set(playerRows.map(p => p.user))
          return (
            playerIds.has(gm.matches.user1 ?? '') ||
            playerIds.has(gm.matches.user2 ?? '')
          )
        })

        const allCompleted = relevantMatches.every(
          gm => gm.matches.status === 'completed'
        )

        if (!allCompleted) return

        const standings = TournamentManager.calculateGroupStandings(
          playerRows,
          relevantMatches.map(r => r.matches)
        )

        const ranks = Array.from(
          { length: tournament.advancementCount },
          (_, i) => i + 1
        )
        await Promise.all(
          ranks.map(async rank => {
            const player = standings[rank - 1]

            const [pendingMatches, pendingMatchesB] = await Promise.all([
              db
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
                ),
              db
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
                ),
            ])

            await Promise.all([
              ...pendingMatches.map(pending =>
                TournamentManager.tryCreateBracketMatch(
                  pending,
                  sessionId,
                  player.user
                )
              ),
              ...pendingMatchesB.map(pending =>
                TournamentManager.tryCreateBracketMatch(
                  pending,
                  sessionId,
                  undefined,
                  player.user
                )
              ),
            ])
          })
        )
      })
    )
  }

  private calculateGroupStandings(
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

  private async progressBracket(
    tournamentId: string,
    completedMatchId: string,
    winnerId: string,
    loserId: string | null,
    sessionId: string
  ) {
    const [downstreamWinner, downstreamWinnerB] = await Promise.all([
      db
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
        ),
      db
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
        ),
    ])

    await Promise.all([
      ...downstreamWinner.map(pending =>
        TournamentManager.tryCreateBracketMatch(pending, sessionId, winnerId)
      ),
      ...downstreamWinnerB.map(pending =>
        TournamentManager.tryCreateBracketMatch(
          pending,
          sessionId,
          undefined,
          winnerId
        )
      ),
    ])

    if (loserId) {
      const [downstreamLoser, downstreamLoserB] = await Promise.all([
        db
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
          ),
        db
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
          ),
      ])

      await Promise.all([
        ...downstreamLoser.map(pending =>
          TournamentManager.tryCreateBracketMatch(pending, sessionId, loserId)
        ),
        ...downstreamLoserB.map(pending =>
          TournamentManager.tryCreateBracketMatch(
            pending,
            sessionId,
            undefined,
            loserId
          )
        ),
      ])
    }
  }

  private async tryCreateBracketMatch(
    pendingMatch: typeof tournamentMatches.$inferSelect,
    sessionId: string,
    userA?: string,
    userB?: string
  ) {
    let resolvedUserA = userA
    let resolvedUserB = userB

    ;[resolvedUserA, resolvedUserB] = await Promise.all([
      TournamentManager.resolveBracketUser(pendingMatch, 'A', resolvedUserA),
      TournamentManager.resolveBracketUser(pendingMatch, 'B', resolvedUserB),
    ])

    if (!resolvedUserA || !resolvedUserB) {
      return
    }

    const stage = TournamentManager.getBracketStage(
      pendingMatch.bracket,
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

    const [, , allMatches] = await Promise.all([
      db
        .update(tournamentMatches)
        .set({ match: newMatch.id })
        .where(eq(tournamentMatches.id, pendingMatch.id)),
      RatingManager.recalculate(),
      getAllMatches(),
    ])
    broadcast('all_matches', allMatches)
    broadcast('all_rankings', RatingManager.onGetRatings())
  }

  private async resolveBracketUser(
    pendingMatch: typeof tournamentMatches.$inferSelect,
    side: 'A' | 'B',
    user?: string
  ) {
    if (user) return user

    if (side === 'A') {
      if (pendingMatch.sourceGroupA && pendingMatch.sourceGroupARank) {
        return TournamentManager.getGroupRankedPlayer(
          pendingMatch.sourceGroupA,
          pendingMatch.sourceGroupARank,
          pendingMatch.tournament
        )
      }

      if (pendingMatch.sourceMatchA && pendingMatch.sourceMatchAProgression) {
        return TournamentManager.getMatchProgressedPlayer(
          pendingMatch.sourceMatchA,
          pendingMatch.sourceMatchAProgression
        )
      }

      return undefined
    }

    if (pendingMatch.sourceGroupB && pendingMatch.sourceGroupBRank) {
      return TournamentManager.getGroupRankedPlayer(
        pendingMatch.sourceGroupB,
        pendingMatch.sourceGroupBRank,
        pendingMatch.tournament
      )
    }

    if (pendingMatch.sourceMatchB && pendingMatch.sourceMatchBProgression) {
      return TournamentManager.getMatchProgressedPlayer(
        pendingMatch.sourceMatchB,
        pendingMatch.sourceMatchBProgression
      )
    }

    return undefined
  }

  private async getGroupRankedPlayer(
    groupId: string,
    rank: number,
    tournamentId: string
  ): Promise<string | undefined> {
    const [playerRows, groupMatchRows] = await Promise.all([
      db
        .select()
        .from(groupPlayers)
        .where(
          and(eq(groupPlayers.group, groupId), isNull(groupPlayers.deletedAt))
        ),
      db
        .select()
        .from(tournamentMatches)
        .innerJoin(matches, eq(tournamentMatches.match, matches.id))
        .where(
          and(
            eq(tournamentMatches.tournament, tournamentId),
            eq(tournamentMatches.bracket, 'group'),
            isNull(tournamentMatches.deletedAt)
          )
        ),
    ])

    const playerIds = new Set(playerRows.map(p => p.user))
    const relevantMatches = groupMatchRows.filter(
      gm =>
        playerIds.has(gm.matches.user1 ?? '') ||
        playerIds.has(gm.matches.user2 ?? '')
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

  private async getMatchProgressedPlayer(
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

  private getBracketStage(
    bracket: TournamentBracket,
    round: number | null
  ): MatchStage {
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

  async onGetTournamentPreview(
    socket: TypedSocket,
    request: TournamentPreviewRequest
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
      request.eliminationType
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

    const tournamentWithDetails = TournamentManager.toTournamentWithDetails({
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
const TournamentManager = new TournamentManagerClass()

export default TournamentManager
