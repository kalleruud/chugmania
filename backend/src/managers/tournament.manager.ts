import type { Match } from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import type { TimeEntry } from '@common/models/timeEntry'
import type {
  PreviewTournamentRequest,
  SlotDependency,
  TournamentDetails,
  TournamentGroupBlock,
  TournamentMatchDetail,
  TournamentQualificationRow,
} from '@common/models/tournament'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isPreviewTournamentRequest,
} from '@common/models/tournament'
import {
  combinationValid,
  snapToValidCombination,
} from '@common/tournament/constraints'
import { computeTournamentWorkloadSummary } from '@common/tournament/workload'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import loc from '../../../frontend/lib/locales'
import db, { database } from '../../database/database'
import {
  groupPlayers,
  groups,
  matches,
  sessions,
  sessionSignups,
  timeEntries,
  tournamentMatches,
  tournaments,
  tournamentStageTracks,
  tracks,
  users,
  type MatchStage,
  type TournamentBracket,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import { computeQualificationOrder } from '../tournament/qualification'
import {
  groupPlayComplete,
  resolveSlotValue,
  type MatchRowLite,
} from '../tournament/slots'
import {
  computeGroupStandings,
  type StandingMatch,
  type StandingRow,
} from '../tournament/standings'
import {
  generateTournamentDraft,
  type DraftMatch,
} from '../tournament/tournament-draft'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import UserManager from './user.manager'

function encDep(d: SlotDependency | null): string | null {
  return d ? JSON.stringify(d) : null
}

function decDep(s: string | null | undefined): SlotDependency | null {
  if (!s) return null
  return JSON.parse(s) as SlotDependency
}

export default class TournamentManager {
  static async getActiveTournamentRow(sessionId: string) {
    return await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.session, sessionId),
        isNull(tournaments.deletedAt)
      ),
    })
  }

  static assertSessionOk(session: typeof sessions.$inferSelect) {
    if (session.status === 'cancelled') {
      throw new Error(loc.no.tournament.error.sessionCancelled)
    }
  }

  static confirmedParticipants(sessionId: string) {
    return db
      .select({ user: sessionSignups.user })
      .from(sessionSignups)
      .where(
        and(
          eq(sessionSignups.session, sessionId),
          eq(sessionSignups.response, 'yes'),
          isNull(sessionSignups.deletedAt)
        )
      )
      .then(r => r.map(x => x.user))
  }

  static async validateTrackIds(ids: string[]) {
    const uniq = [...new Set(ids.filter(Boolean))]
    if (uniq.length === 0) return
    const found = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(and(inArray(tracks.id, uniq), isNull(tracks.deletedAt)))
    if (found.length !== uniq.length) {
      throw new Error(loc.no.tournament.error.invalidTrack)
    }
  }

  static async buildDetailsForSession(
    sessionId: string,
    isPreview: boolean,
    previewDraft?: ReturnType<typeof generateTournamentDraft>,
    previewConfig?: PreviewTournamentRequest
  ): Promise<TournamentDetails | null> {
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), isNull(sessions.deletedAt)),
    })
    if (!session) return null

    const participantIds =
      await TournamentManager.confirmedParticipants(sessionId)
    const rankingRows = await RatingManager.onGetRatings()
    const teRows = await db
      .select()
      .from(timeEntries)
      .where(
        and(eq(timeEntries.session, sessionId), isNull(timeEntries.deletedAt))
      )

    const userRows = await db
      .select()
      .from(users)
      .where(isNull(users.deletedAt))
    const userMap = new Map(userRows.map(u => [u.id, u] as const))

    if (isPreview && previewDraft && previewConfig) {
      const { orderedIds, rankByUser } = computeQualificationOrder(
        participantIds,
        previewConfig.qualificationTrackId,
        sessionId,
        teRows,
        rankingRows
      )
      return TournamentManager.detailsFromDraft(
        sessionId,
        previewConfig,
        previewDraft,
        orderedIds,
        rankByUser,
        teRows,
        userMap,
        true
      )
    }

    const trow = await TournamentManager.getActiveTournamentRow(sessionId)
    if (!trow) return null

    const qualTrack = trow.qualificationTrack

    const gRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, trow.id), isNull(groups.deletedAt)))
      .orderBy(asc(groups.name))

    const gids = gRows.map(g => g.id)
    const gpRows =
      gids.length === 0
        ? []
        : await db
            .select()
            .from(groupPlayers)
            .where(
              and(
                isNull(groupPlayers.deletedAt),
                inArray(groupPlayers.group, gids)
              )
            )

    const tmRows = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, trow.id),
          isNull(tournamentMatches.deletedAt)
        )
      )
      .orderBy(asc(tournamentMatches.sortOrder))

    const matchIds = tmRows.map(t => t.match).filter((m): m is string => !!m)
    const mRows =
      matchIds.length > 0
        ? await db
            .select()
            .from(matches)
            .where(
              and(inArray(matches.id, matchIds), isNull(matches.deletedAt))
            )
        : []
    const matchMap = new Map(mRows.map(m => [m.id, m] as const))

    const live = computeQualificationOrder(
      participantIds,
      qualTrack,
      sessionId,
      teRows,
      rankingRows
    )
    const tiebreakLocked =
      gpRows.length > 0 && gpRows.every(p => p.tiebreakQualRank != null)
    const rankByUser = new Map<string, number>()
    if (tiebreakLocked) {
      for (const p of gpRows) {
        rankByUser.set(p.user, p.tiebreakQualRank!)
      }
    } else {
      for (const [k, v] of live.rankByUser) rankByUser.set(k, v)
    }
    const orderedIds = tiebreakLocked
      ? [...participantIds].toSorted((a, b) => {
          const ra = rankByUser.get(a) ?? 1e9
          const rb = rankByUser.get(b) ?? 1e9
          if (ra !== rb) return ra - rb
          return a.localeCompare(b)
        })
      : live.orderedIds

    const qualification = TournamentManager.qualificationRows(
      orderedIds,
      rankByUser,
      qualTrack,
      sessionId,
      teRows,
      userMap
    )

    const blocks: TournamentGroupBlock[] = gRows.map(g => {
      const members = gpRows
        .filter(p => p.group === g.id)
        .toSorted((a, b) => a.seed - b.seed)
        .map(p => p.user)
      const groupTms = tmRows.filter(t => t.bracket === 'group')
      const gMatches: StandingMatch[] = []
      for (const tm of groupTms) {
        const m = tm.match ? matchMap.get(tm.match) : undefined
        if (!m?.user1 || !m?.user2) continue
        if (!members.includes(m.user1) || !members.includes(m.user2)) continue
        gMatches.push({
          user1: m.user1,
          user2: m.user2,
          winner: m.winner,
          status: m.status,
        })
      }
      const standingRows = computeGroupStandings(
        members,
        gMatches,
        rankByUser,
        trow.advancementCount
      )
      return {
        id: g.id,
        name: g.name,
        memberUserIds: members,
        standings: standingRows.map(s => {
          const u = userMap.get(s.userId)
          if (!u) throw new Error(loc.no.error.messages.not_in_db(s.userId))
          return {
            ...s,
            user: UserManager.toUserInfo(u).userInfo,
          }
        }),
      }
    })

    const stageOrdinals = TournamentManager.computeStageOrdinals(tmRows)

    const matchDetails: TournamentMatchDetail[] = tmRows.map(tm => {
      const m = tm.match ? (matchMap.get(tm.match) ?? null) : null
      const slot1 = decDep(tm.slot1Dependency)
      const slot2 = decDep(tm.slot2Dependency)
      const ord =
        stageOrdinals.get(`${tm.bracket}:${tm.stage}:${tm.sortOrder}`) ?? null
      const { label1, label2 } = TournamentManager.slotLabels(
        slot1,
        slot2,
        gRows.map(g => ({ id: g.id, name: g.name })),
        tmRows,
        matchMap,
        stageOrdinals
      )
      return {
        id: tm.match ?? tm.id,
        tournamentMatchId: tm.id,
        name: tm.name,
        bracket: tm.bracket,
        stage: tm.stage,
        stageLabel: TournamentManager.stageLabel(tm.stage, tm.bracket, ord),
        sortOrder: tm.sortOrder,
        match: m,
        trackId: tm.track,
        readOnly: tm.bracket !== 'group' && (!m?.user1 || !m?.user2),
        slot1Label: label1,
        slot2Label: label2,
        slot1Dependency: slot1,
        slot2Dependency: slot2,
      }
    })

    const completed = mRows.filter(m => m.status === 'completed').length
    const groupTms = tmRows.filter(t => t.bracket === 'group')
    const groupDone = groupTms.filter(
      t => t.match && matchMap.get(t.match!)?.status === 'completed'
    ).length

    const usedStages: MatchStage[] = []
    const seenStage = new Set<MatchStage>()
    for (const tm of tmRows) {
      if (!seenStage.has(tm.stage)) {
        seenStage.add(tm.stage)
        usedStages.push(tm.stage)
      }
    }

    const workloadSummary = computeTournamentWorkloadSummary({
      qualificationTrackId: qualTrack,
      matchTrackIds: matchDetails.map(m => m.trackId),
      groups: blocks.map(b => ({ memberUserIds: b.memberUserIds })),
      groupsCount: trow.groupsCount,
      advancementCount: trow.advancementCount,
      eliminationType: trow.eliminationType,
    })

    return {
      id: trow.id,
      sessionId,
      name: trow.name,
      description: trow.description ?? null,
      qualificationTrackId: qualTrack,
      groupsCount: trow.groupsCount,
      advancementCount: trow.advancementCount,
      eliminationType: trow.eliminationType,
      usedStages,
      qualification,
      groups: blocks,
      matches: matchDetails,
      progress: {
        completedTournamentMatches: completed,
        totalTournamentMatches: tmRows.length,
        groupMatchesCompleted: groupDone,
        groupMatchesTotal: groupTms.length,
      },
      workloadSummary,
      isPreview: false,
    }
  }

  static stageLabel(
    stage: MatchStage,
    bracket: TournamentBracket,
    ordinal: number | null
  ): string {
    const base = loc.no.match.stage[stage]
    if (ordinal != null) return `${base} ${ordinal}`
    return base
  }

  static computeStageOrdinals(
    tmRows: (typeof tournamentMatches.$inferSelect)[]
  ): Map<string, number | null> {
    const byKey = new Map<string, (typeof tournamentMatches.$inferSelect)[]>()
    for (const tm of tmRows) {
      const k = `${tm.bracket}:${tm.stage}`
      const list = byKey.get(k) ?? []
      list.push(tm)
      byKey.set(k, list)
    }
    const out = new Map<string, number | null>()
    for (const [, list] of byKey) {
      const sorted = list.toSorted((a, b) => a.sortOrder - b.sortOrder)
      const multi = sorted.length > 1
      sorted.forEach((tm, idx) => {
        out.set(
          `${tm.bracket}:${tm.stage}:${tm.sortOrder}`,
          multi ? idx + 1 : null
        )
      })
    }
    return out
  }

  static matchLabelForTournamentRow(
    tm: typeof tournamentMatches.$inferSelect,
    stageOrdinals: Map<string, number | null>
  ): string {
    const ord =
      stageOrdinals.get(`${tm.bracket}:${tm.stage}:${tm.sortOrder}`) ?? null
    return TournamentManager.stageLabel(tm.stage, tm.bracket, ord)
  }

  static slotLabels(
    slot1: SlotDependency | null,
    slot2: SlotDependency | null,
    groupMeta: { id: string; name: string }[],
    tmRows: (typeof tournamentMatches.$inferSelect)[],
    matchMap: Map<string, Match>,
    stageOrdinals: Map<string, number | null>
  ): { label1: string | null; label2: string | null } {
    const gName = (id: string) => groupMeta.find(g => g.id === id)?.name ?? id
    const mLabel = (mid: string) => {
      const tm = tmRows.find(t => t.match === mid)
      if (!tm) return mid
      return TournamentManager.matchLabelForTournamentRow(tm, stageOrdinals)
    }
    const one = (s: SlotDependency | null): string | null => {
      if (!s) return null
      if (s.kind === 'group_rank') {
        const gn = gName(s.groupId)
        if (s.rank === 1) return loc.no.tournament.slot.winnerOfGroup(gn)
        if (s.rank === 2) return loc.no.tournament.slot.runnerUpInGroup(gn)
        return loc.no.tournament.slot.placeInGroup(s.rank, gn)
      }
      if (s.kind === 'match_winner')
        return loc.no.tournament.slot.winnerOfMatch(mLabel(s.matchId))
      return loc.no.tournament.slot.loserOfMatch(mLabel(s.matchId))
    }
    return { label1: one(slot1), label2: one(slot2) }
  }

  static qualificationRows(
    orderedIds: string[],
    rankByUser: Map<string, number>,
    qualificationTrackId: string,
    sessionId: string,
    teRows: (typeof timeEntries.$inferSelect)[],
    userMap: Map<string, typeof users.$inferSelect>
  ): TournamentQualificationRow[] {
    const valid = teRows.filter(
      e =>
        e.track === qualificationTrackId &&
        e.session === sessionId &&
        !e.deletedAt &&
        e.duration != null &&
        e.duration > 0
    )
    const best = new Map<string, typeof timeEntries.$inferSelect>()
    for (const e of valid) {
      const cur = best.get(e.user)
      if (!cur || e.duration! < cur.duration!) best.set(e.user, e)
    }
    return orderedIds.map(uid => {
      const row = userMap.get(uid)
      if (!row) throw new Error(loc.no.error.messages.not_in_db(uid))
      const be = best.get(uid)
      const pending = !be
      return {
        userId: uid,
        user: UserManager.toUserInfo(row).userInfo,
        rank: rankByUser.get(uid)!,
        pending,
        bestDurationMs: be?.duration ?? null,
        timeEntry: pending ? null : (be as unknown as TimeEntry),
      }
    })
  }

  static detailsFromDraft(
    sessionId: string,
    cfg: PreviewTournamentRequest,
    draft: ReturnType<typeof generateTournamentDraft>,
    orderedIds: string[],
    rankByUser: Map<string, number>,
    teRows: (typeof timeEntries.$inferSelect)[],
    userMap: Map<string, typeof users.$inferSelect>,
    isPreview: boolean
  ): TournamentDetails {
    const qualification = TournamentManager.qualificationRows(
      orderedIds,
      rankByUser,
      cfg.qualificationTrackId,
      sessionId,
      teRows,
      userMap
    )

    const blocks: TournamentGroupBlock[] = draft.groups.map(g => {
      const standingRows = computeGroupStandings(
        g.memberUserIds,
        [],
        rankByUser,
        cfg.advancementCount
      )
      return {
        id: g.key,
        name: g.name,
        memberUserIds: g.memberUserIds,
        standings: standingRows.map(s => {
          const u = userMap.get(s.userId)
          if (!u) throw new Error(loc.no.error.messages.not_in_db(s.userId))
          return {
            ...s,
            user: UserManager.toUserInfo(u).userInfo,
          }
        }),
      }
    })

    const fakeTmRows = draft.matches.map(dm => ({
      id: dm.key,
      bracket: dm.bracket,
      stage: dm.stage,
      sortOrder: dm.sortOrder,
      match: dm.key,
      name: dm.name,
      slot1Dependency: encDep(dm.slot1),
      slot2Dependency: encDep(dm.slot2),
    })) as unknown as (typeof tournamentMatches.$inferSelect)[]

    const stageOrdinals = TournamentManager.computeStageOrdinals(fakeTmRows)
    const gMeta = draft.groups.map(g => ({ id: g.key, name: g.name }))
    const matchMap = new Map<string, Match>()
    for (const dm of draft.matches) {
      matchMap.set(
        dm.key,
        TournamentManager.syntheticMatch(
          sessionId,
          dm,
          cfg.qualificationTrackId
        )
      )
    }

    const matchDetails: TournamentMatchDetail[] = draft.matches.map(dm => {
      const slot1 = dm.slot1
      const slot2 = dm.slot2
      const ord =
        stageOrdinals.get(`${dm.bracket}:${dm.stage}:${dm.sortOrder}`) ?? null
      const { label1, label2 } = TournamentManager.slotLabels(
        slot1,
        slot2,
        gMeta,
        fakeTmRows,
        matchMap,
        stageOrdinals
      )
      const syn = matchMap.get(dm.key)!
      return {
        id: dm.key,
        tournamentMatchId: dm.key,
        name: dm.name,
        bracket: dm.bracket,
        stage: dm.stage,
        stageLabel: TournamentManager.stageLabel(dm.stage, dm.bracket, ord),
        sortOrder: dm.sortOrder,
        match: syn,
        trackId: dm.trackId,
        readOnly: true,
        slot1Label: label1,
        slot2Label: label2,
        slot1Dependency: slot1,
        slot2Dependency: slot2,
      }
    })

    const workloadSummary = computeTournamentWorkloadSummary({
      qualificationTrackId: cfg.qualificationTrackId,
      matchTrackIds: draft.matches.map(m => m.trackId),
      groups: draft.groups.map(g => ({ memberUserIds: g.memberUserIds })),
      groupsCount: cfg.groupsCount,
      advancementCount: cfg.advancementCount,
      eliminationType: cfg.eliminationType,
    })

    return {
      id: `preview-${sessionId}`,
      sessionId,
      name: cfg.name.trim(),
      description: cfg.description ?? null,
      qualificationTrackId: cfg.qualificationTrackId,
      groupsCount: cfg.groupsCount,
      advancementCount: cfg.advancementCount,
      eliminationType: cfg.eliminationType,
      usedStages: draft.usedStages,
      qualification,
      groups: blocks,
      matches: matchDetails,
      progress: {
        completedTournamentMatches: 0,
        totalTournamentMatches: draft.matches.length,
        groupMatchesCompleted: 0,
        groupMatchesTotal: draft.matches.filter(m => m.bracket === 'group')
          .length,
      },
      workloadSummary,
      isPreview,
    }
  }

  static syntheticMatch(
    sessionId: string,
    dm: DraftMatch,
    _qualTrack: string
  ): Match {
    return {
      id: dm.key,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      user1: dm.user1,
      user2: dm.user2,
      track: dm.trackId,
      session: sessionId,
      winner: null,
      duration: null,
      stage: dm.stage,
      tournamentBracket: dm.bracket,
      comment: null,
      status: 'planned',
    }
  }

  static groupPlayStarted(
    tmRows: (typeof tournamentMatches.$inferSelect)[],
    matchMap: Map<string, Match>
  ): boolean {
    for (const tm of tmRows) {
      if (tm.bracket !== 'group') continue
      if (!tm.match) continue
      const m = matchMap.get(tm.match)
      if (m && m.status !== 'planned') return true
    }
    return false
  }

  static async lockTiebreakQualificationIfNeeded(tournamentId: string) {
    const trow = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, tournamentId),
        isNull(tournaments.deletedAt)
      ),
    })
    if (!trow) return

    const gRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))
    const gids2 = gRows.map(g => g.id)
    const gpRows =
      gids2.length === 0
        ? []
        : await db
            .select()
            .from(groupPlayers)
            .where(
              and(
                isNull(groupPlayers.deletedAt),
                inArray(groupPlayers.group, gids2)
              )
            )
    if (gpRows.length === 0) return
    if (gpRows.every(p => p.tiebreakQualRank != null)) return

    const tmRows = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          isNull(tournamentMatches.deletedAt)
        )
      )
    const matchIds = tmRows.map(t => t.match).filter((m): m is string => !!m)
    const mRows =
      matchIds.length > 0
        ? await db
            .select()
            .from(matches)
            .where(
              and(inArray(matches.id, matchIds), isNull(matches.deletedAt))
            )
        : []
    const matchMap = new Map(mRows.map(m => [m.id, m] as const))
    if (!TournamentManager.groupPlayStarted(tmRows, matchMap)) return

    const participantIds = await TournamentManager.confirmedParticipants(
      trow.session
    )
    const rankingRows = await RatingManager.onGetRatings()
    const teRows = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.session, trow.session),
          isNull(timeEntries.deletedAt)
        )
      )
    const { rankByUser } = computeQualificationOrder(
      participantIds,
      trow.qualificationTrack,
      trow.session,
      teRows,
      rankingRows
    )

    database.transaction(() => {
      for (const gp of gpRows) {
        const r = rankByUser.get(gp.user)
        if (r === undefined) continue
        db.update(groupPlayers)
          .set({ tiebreakQualRank: r })
          .where(eq(groupPlayers.id, gp.id))
          .run()
      }
    })()
  }

  static assertValidDraftSlotDependencies(
    draft: ReturnType<typeof generateTournamentDraft>
  ) {
    const matchIds = new Set(draft.matches.map(m => m.key))
    for (const m of draft.matches) {
      for (const dep of [m.slot1, m.slot2] as const) {
        if (!dep) continue
        if (dep.kind === 'group_rank') {
          const g = draft.groups.find(x => x.key === dep.groupId)
          if (!g || dep.rank < 1 || dep.rank > g.memberUserIds.length) {
            throw new Error(loc.no.tournament.error.invalidBracketDependency)
          }
        } else if (dep.kind === 'match_winner' || dep.kind === 'match_loser') {
          if (!matchIds.has(dep.matchId)) {
            throw new Error(loc.no.tournament.error.invalidBracketDependency)
          }
        }
      }
    }
  }

  static async resolveSlots(tournamentId: string) {
    await TournamentManager.lockTiebreakQualificationIfNeeded(tournamentId)

    const trow = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, tournamentId),
        isNull(tournaments.deletedAt)
      ),
    })
    if (!trow) return

    const gRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))

    const gids2 = gRows.map(g => g.id)
    const gpRows =
      gids2.length === 0
        ? []
        : await db
            .select()
            .from(groupPlayers)
            .where(
              and(
                isNull(groupPlayers.deletedAt),
                inArray(groupPlayers.group, gids2)
              )
            )

    const tmRows = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          isNull(tournamentMatches.deletedAt)
        )
      )

    const matchIds = tmRows.map(t => t.match).filter((m): m is string => !!m)
    const mRows = await db
      .select()
      .from(matches)
      .where(and(inArray(matches.id, matchIds), isNull(matches.deletedAt)))
    const matchMap = new Map(mRows.map(m => [m.id, m] as const))

    const participantIds = await TournamentManager.confirmedParticipants(
      trow.session
    )
    const rankingRows = await RatingManager.onGetRatings()
    const teRows = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.session, trow.session),
          isNull(timeEntries.deletedAt)
        )
      )
    const live = computeQualificationOrder(
      participantIds,
      trow.qualificationTrack,
      trow.session,
      teRows,
      rankingRows
    )
    const tiebreakLocked =
      gpRows.length > 0 && gpRows.every(p => p.tiebreakQualRank != null)
    const rankByUser = new Map<string, number>()
    if (tiebreakLocked) {
      for (const p of gpRows) {
        rankByUser.set(p.user, p.tiebreakQualRank!)
      }
    } else {
      for (const [k, v] of live.rankByUser) rankByUser.set(k, v)
    }

    const standingsByGroupId = new Map<string, StandingRow[]>()
    const groupComplete = new Map<string, boolean>()

    for (const g of gRows) {
      const members = gpRows
        .filter(p => p.group === g.id)
        .toSorted((a, b) => a.seed - b.seed)
        .map(p => p.user)
      const groupTms = tmRows.filter(t => t.bracket === 'group')
      const gMatches: MatchRowLite[] = []
      for (const tm of groupTms) {
        const m = tm.match ? matchMap.get(tm.match) : undefined
        if (!m) continue
        if (
          m.user1 &&
          m.user2 &&
          members.includes(m.user1) &&
          members.includes(m.user2)
        ) {
          gMatches.push({
            id: m.id,
            user1: m.user1,
            user2: m.user2,
            winner: m.winner,
            status: m.status,
          })
        }
      }
      const st = computeGroupStandings(
        members,
        gMatches.map(x => ({
          user1: x.user1,
          user2: x.user2,
          winner: x.winner,
          status: x.status,
        })),
        rankByUser,
        trow.advancementCount
      )
      standingsByGroupId.set(g.id, st)
      groupComplete.set(g.id, groupPlayComplete(g.id, members, gMatches))
    }

    const matchById = new Map<string, MatchRowLite>()
    for (const m of mRows) {
      matchById.set(m.id, {
        id: m.id,
        user1: m.user1,
        user2: m.user2,
        winner: m.winner,
        status: m.status,
      })
    }

    const ctx = {
      standingsByGroupId,
      groupComplete,
      matchById,
    }

    let changed = true
    while (changed) {
      changed = false
      for (const tm of tmRows) {
        if (tm.bracket === 'group') continue
        const m = tm.match ? matchMap.get(tm.match) : undefined
        if (!m) continue
        const s1 = decDep(tm.slot1Dependency)
        const s2 = decDep(tm.slot2Dependency)
        const r1 = resolveSlotValue(s1, ctx)
        const r2 = resolveSlotValue(s2, ctx)
        if (r1 !== m.user1 || r2 !== m.user2) {
          await db
            .update(matches)
            .set({ user1: r1, user2: r2 })
            .where(eq(matches.id, m.id))
          m.user1 = r1
          m.user2 = r2
          matchById.set(m.id, {
            id: m.id,
            user1: r1,
            user2: r2,
            winner: m.winner,
            status: m.status,
          })
          changed = true
        }
      }
    }
  }

  static async broadcastSessionTournament(sessionId: string) {
    const details = await TournamentManager.buildDetailsForSession(
      sessionId,
      false
    )
    broadcast('session_tournament', { sessionId, details })
  }

  static async onGetTournamentDetails(
    _socket: TypedSocket,
    request: EventReq<'get_tournament_details'>
  ): Promise<EventRes<'get_tournament_details'>> {
    const details = await TournamentManager.buildDetailsForSession(
      request.sessionId,
      false
    )
    return { success: true, details }
  }

  static async onPreviewTournament(
    socket: TypedSocket,
    request: EventReq<'preview_tournament'>
  ): Promise<EventRes<'preview_tournament'>> {
    if (!isPreviewTournamentRequest(request)) {
      return {
        success: false,
        message: loc.no.error.messages.invalid_request(
          'PreviewTournamentRequest'
        ),
      }
    }
    try {
      await AuthManager.checkAuth(socket, ['admin', 'moderator'])
      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.id, request.sessionId),
          isNull(sessions.deletedAt)
        ),
      })
      if (!session) {
        return {
          success: false,
          message: loc.no.error.messages.not_in_db('session'),
        }
      }
      TournamentManager.assertSessionOk(session)

      const existing = await TournamentManager.getActiveTournamentRow(
        request.sessionId
      )
      if (existing) {
        return {
          success: false,
          message: loc.no.tournament.error.alreadyExists,
        }
      }

      const pids = await TournamentManager.confirmedParticipants(
        request.sessionId
      )
      if (pids.length < 4) {
        return {
          success: false,
          message: loc.no.tournament.error.tooFewPlayers,
        }
      }

      let g = request.groupsCount
      let a = request.advancementCount
      if (!combinationValid(pids.length, g, a, request.eliminationType)) {
        const sn = snapToValidCombination({
          participantCount: pids.length,
          groupsCount: g,
          advancementCount: a,
          eliminationType: request.eliminationType,
        })
        g = sn.groupsCount
        a = sn.advancementCount
      }
      if (!combinationValid(pids.length, g, a, request.eliminationType)) {
        return {
          success: false,
          message: loc.no.tournament.error.invalidConfig,
        }
      }

      await TournamentManager.validateTrackIds([
        request.qualificationTrackId,
        ...Object.values(request.stageTracks).flatMap(x => x ?? []),
      ])

      const rankingRows = await RatingManager.onGetRatings()
      const teRows = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.session, request.sessionId),
            isNull(timeEntries.deletedAt)
          )
        )
      const { orderedIds, rankByUser } = computeQualificationOrder(
        pids,
        request.qualificationTrackId,
        request.sessionId,
        teRows,
        rankingRows
      )

      const userRows = await db
        .select()
        .from(users)
        .where(isNull(users.deletedAt))
      const userMap = new Map(userRows.map(u => [u.id, u] as const))
      const label = (uid: string) => {
        const u = userMap.get(uid)
        if (!u) return uid
        const info = UserManager.toUserInfo(u).userInfo
        return info.shortName ?? info.lastName ?? info.firstName
      }

      const draft = generateTournamentDraft({
        orderedParticipantIds: orderedIds,
        qualificationRank: rankByUser,
        groupsCount: g,
        advancementCount: a,
        eliminationType: request.eliminationType,
        stageTracks: request.stageTracks,
        matchKeyFactory: hint => `preview-${hint}-${randomUUID()}`,
        userLabel: label,
      })

      const details = TournamentManager.detailsFromDraft(
        request.sessionId,
        { ...request, groupsCount: g, advancementCount: a },
        draft,
        orderedIds,
        rankByUser,
        teRows,
        userMap,
        true
      )
      return { success: true, details }
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }

  static async onCreateTournament(
    socket: TypedSocket,
    request: EventReq<'create_tournament'>
  ): Promise<EventRes<'create_tournament'>> {
    if (!isCreateTournamentRequest(request)) {
      return {
        success: false,
        message: loc.no.error.messages.invalid_request(
          'CreateTournamentRequest'
        ),
      }
    }
    try {
      await AuthManager.checkAuth(socket, ['admin', 'moderator'])
      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.id, request.sessionId),
          isNull(sessions.deletedAt)
        ),
      })
      if (!session) {
        return {
          success: false,
          message: loc.no.error.messages.not_in_db('session'),
        }
      }
      TournamentManager.assertSessionOk(session)

      const existing = await TournamentManager.getActiveTournamentRow(
        request.sessionId
      )
      if (existing) {
        return {
          success: false,
          message: loc.no.tournament.error.alreadyExists,
        }
      }

      if (!request.name.trim()) {
        return { success: false, message: loc.no.tournament.error.blankName }
      }

      const pids = await TournamentManager.confirmedParticipants(
        request.sessionId
      )
      if (pids.length < 4) {
        return {
          success: false,
          message: loc.no.tournament.error.tooFewPlayers,
        }
      }

      const g = request.groupsCount
      const a = request.advancementCount
      if (!combinationValid(pids.length, g, a, request.eliminationType)) {
        return {
          success: false,
          message: loc.no.tournament.error.invalidConfig,
        }
      }

      await TournamentManager.validateTrackIds([
        request.qualificationTrackId,
        ...Object.values(request.stageTracks).flatMap(x => x ?? []),
      ])

      const rankingRows = await RatingManager.onGetRatings()
      const teRows = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.session, request.sessionId),
            isNull(timeEntries.deletedAt)
          )
        )
      const { orderedIds, rankByUser } = computeQualificationOrder(
        pids,
        request.qualificationTrackId,
        request.sessionId,
        teRows,
        rankingRows
      )

      const userRows = await db
        .select()
        .from(users)
        .where(isNull(users.deletedAt))
      const userMap = new Map(userRows.map(u => [u.id, u] as const))
      const label = (uid: string) => {
        const u = userMap.get(uid)
        if (!u) return uid
        const info = UserManager.toUserInfo(u).userInfo
        return info.shortName ?? info.lastName ?? info.firstName
      }

      const draft = generateTournamentDraft({
        orderedParticipantIds: orderedIds,
        qualificationRank: rankByUser,
        groupsCount: g,
        advancementCount: a,
        eliminationType: request.eliminationType,
        stageTracks: request.stageTracks,
        matchKeyFactory: () => randomUUID(),
        userLabel: label,
      })

      TournamentManager.assertValidDraftSlotDependencies(draft)

      for (const m of draft.matches) {
        if (!m.trackId) {
          return {
            success: false,
            message: loc.no.tournament.error.missingTrack,
          }
        }
      }

      const tournamentId = randomUUID()
      const now = new Date()

      database.transaction(() => {
        db.insert(tournaments)
          .values({
            id: tournamentId,
            session: request.sessionId,
            name: request.name.trim(),
            description: request.description ?? null,
            qualificationTrack: request.qualificationTrackId,
            groupsCount: g,
            advancementCount: a,
            eliminationType: request.eliminationType,
            createdAt: now,
          })
          .run()

        for (const stage of draft.usedStages) {
          const list = request.stageTracks[stage] ?? []
          list.forEach((trackId, position) => {
            db.insert(tournamentStageTracks)
              .values({
                id: randomUUID(),
                tournament: tournamentId,
                stage,
                position,
                track: trackId,
                createdAt: now,
              })
              .run()
          })
        }

        for (const gr of draft.groups) {
          db.insert(groups)
            .values({
              id: gr.key,
              tournament: tournamentId,
              name: gr.name,
              createdAt: now,
            })
            .run()
          gr.memberUserIds.forEach((uid, seed) => {
            db.insert(groupPlayers)
              .values({
                id: randomUUID(),
                group: gr.key,
                user: uid,
                seed,
                createdAt: now,
              })
              .run()
          })
        }

        for (const dm of draft.matches) {
          db.insert(matches)
            .values({
              id: dm.key,
              session: request.sessionId,
              user1: dm.user1,
              user2: dm.user2,
              track: dm.trackId,
              stage: dm.stage,
              tournamentBracket: dm.bracket,
              status: 'planned',
              createdAt: now,
            })
            .run()
          db.insert(tournamentMatches)
            .values({
              id: randomUUID(),
              tournament: tournamentId,
              name: dm.name,
              bracket: dm.bracket,
              stage: dm.stage,
              sortOrder: dm.sortOrder,
              match: dm.key,
              track: dm.trackId,
              slot1Dependency: encDep(dm.slot1),
              slot2Dependency: encDep(dm.slot2),
              createdAt: now,
            })
            .run()
        }
      })()

      await TournamentManager.resolveSlots(tournamentId)
      await RatingManager.recalculate()
      broadcast('all_matches', await MatchManager.getAllMatches())
      await TournamentManager.broadcastSessionTournament(request.sessionId)
      return { success: true }
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }

  static async onDeleteTournament(
    socket: TypedSocket,
    request: EventReq<'delete_tournament'>
  ): Promise<EventRes<'delete_tournament'>> {
    if (!isDeleteTournamentRequest(request)) {
      return {
        success: false,
        message: loc.no.error.messages.invalid_request(
          'DeleteTournamentRequest'
        ),
      }
    }
    try {
      await AuthManager.checkAuth(socket, ['admin', 'moderator'])
      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.id, request.sessionId),
          isNull(sessions.deletedAt)
        ),
      })
      if (!session) {
        return { success: true }
      }
      TournamentManager.assertSessionOk(session)

      const trow = await TournamentManager.getActiveTournamentRow(
        request.sessionId
      )
      if (!trow) {
        return { success: true }
      }

      const now = new Date()
      const tmRows = await db
        .select()
        .from(tournamentMatches)
        .where(eq(tournamentMatches.tournament, trow.id))
      const mids = tmRows.map(t => t.match).filter((m): m is string => !!m)
      const gIdRows = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.tournament, trow.id))
      const delGroupIds = gIdRows.map(r => r.id)

      database.transaction(() => {
        for (const mid of mids) {
          db.update(matches)
            .set({ deletedAt: now })
            .where(eq(matches.id, mid))
            .run()
        }
        db.update(tournamentMatches)
          .set({ deletedAt: now })
          .where(eq(tournamentMatches.tournament, trow.id))
          .run()
        db.update(tournamentStageTracks)
          .set({ deletedAt: now })
          .where(eq(tournamentStageTracks.tournament, trow.id))
          .run()
        if (delGroupIds.length > 0) {
          db.update(groupPlayers)
            .set({ deletedAt: now })
            .where(inArray(groupPlayers.group, delGroupIds))
            .run()
        }
        db.update(groups)
          .set({ deletedAt: now })
          .where(eq(groups.tournament, trow.id))
          .run()
        db.update(tournaments)
          .set({ deletedAt: now })
          .where(eq(tournaments.id, trow.id))
          .run()
      })()

      await RatingManager.recalculate()
      broadcast('all_matches', await MatchManager.getAllMatches())
      await TournamentManager.broadcastSessionTournament(request.sessionId)
      return { success: true }
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }

  static async afterMatchMutation(matchId: string) {
    const tm = await db.query.tournamentMatches.findFirst({
      where: and(
        eq(tournamentMatches.match, matchId),
        isNull(tournamentMatches.deletedAt)
      ),
    })
    if (!tm) return
    const trow = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, tm.tournament),
        isNull(tournaments.deletedAt)
      ),
    })
    if (!trow) return
    await TournamentManager.resolveSlots(trow.id)
    await TournamentManager.broadcastSessionTournament(trow.session)
  }
}
