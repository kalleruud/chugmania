import loc from '@common/locale/locales'
import type {
  RecycleItem,
  RecycleRequest,
  RecycleTable,
} from '@common/models/recycleBin'
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import db from '../database'
import * as schema from '../schema'
import TransactionSource from './transaction.source'

const tables = { ...schema }

export default class RecycleBinSource {
  static getItems(): RecycleItem[] {
    const items: RecycleItem[] = []
    for (const record of db
      .select()
      .from(tables.users)
      .where(isNotNull(tables.users.deletedAt))
      .all()) {
      if (record.deletedAt)
        items.push({
          table: 'users',
          id: record.id,
          deletedAt: record.deletedAt,
          record: { ...record, passwordHash: undefined },
        })
    }
    for (const record of db
      .select()
      .from(tables.tracks)
      .where(isNotNull(tables.tracks.deletedAt))
      .all()) {
      if (record.deletedAt)
        items.push({
          table: 'tracks',
          id: record.id,
          deletedAt: record.deletedAt,
          record,
        })
    }
    for (const record of db
      .select()
      .from(tables.sessions)
      .where(isNotNull(tables.sessions.deletedAt))
      .all()) {
      if (record.deletedAt)
        items.push({
          table: 'sessions',
          id: record.id,
          deletedAt: record.deletedAt,
          record: { ...record, signups: [] },
        })
    }
    for (const record of db
      .select()
      .from(tables.timeEntries)
      .where(isNotNull(tables.timeEntries.deletedAt))
      .all()) {
      if (record.deletedAt)
        items.push({
          table: 'timeEntries',
          id: record.id,
          deletedAt: record.deletedAt,
          record,
        })
    }
    for (const record of db
      .select()
      .from(tables.matches)
      .where(isNotNull(tables.matches.deletedAt))
      .all()) {
      if (record.deletedAt)
        items.push({
          table: 'matches',
          id: record.id,
          deletedAt: record.deletedAt,
          record,
        })
    }
    const otherTables = {
      sessionSignups: tables.sessionSignups,
      tournaments: tables.tournaments,
      tournamentStages: tables.tournamentStages,
      tournamentGroups: tables.tournamentGroups,
      tournamentPlayers: tables.tournamentPlayers,
      tournamentMatches: tables.tournamentMatches,
      tournamentMatchSlots: tables.tournamentMatchSlots,
      webhookCaptures: tables.webhookCaptures,
      webhookEvents: tables.webhookEvents,
    }
    for (const [name, table] of Object.entries(otherTables)) {
      for (const record of db
        .select()
        .from(table)
        .where(isNotNull(table.deletedAt))
        .all()) {
        if (record.deletedAt) {
          let label = record.id
          if ('name' in record) label = record.name
          else if ('gameId' in record) label = record.gameId
          else if ('eventId' in record)
            label = `${record.type}: ${record.eventId}`
          else if ('stage' in record) label = record.stage
          else if ('kind' in record)
            label = `${record.kind}: ${record.slotHolderId}`
          else if ('user' in record) {
            const user = db
              .select()
              .from(tables.users)
              .where(eq(tables.users.id, record.user))
              .get()
            if (user)
              label = [user.firstName, user.lastName].filter(Boolean).join(' ')
          }
          if ('session' in record) {
            const session = db
              .select()
              .from(tables.sessions)
              .where(eq(tables.sessions.id, record.session))
              .get()
            if (session) label = `${session.name} · ${label}`
          }
          items.push(makeOtherItem(name, record.id, record.deletedAt, label))
        }
      }
    }
    return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
  }

  static mutate(request: RecycleRequest, reconcile: () => void) {
    return TransactionSource.run(() => {
      const table = tables[request.table]
      const record = db
        .select()
        .from(table)
        .where(and(eq(table.id, request.id), isNotNull(table.deletedAt)))
        .get()
      if (!record) throw new Error(loc.no.admin.recycleBin.missing)
      if (request.action === 'delete') {
        for (const candidate of Object.values(tables)) {
          for (const fk of getTableConfig(candidate).foreignKeys) {
            const reference = fk.reference()
            if (reference.foreignTable !== table) continue
            const referenced = db
              .select({ id: candidate.id })
              .from(candidate)
              .where(
                and(
                  ...reference.columns.map((column, index) =>
                    eq(
                      column,
                      sql`(select ${reference.foreignColumns[index]} from ${table} where ${table.id} = ${request.id})`
                    )
                  )
                )
              )
              .get()
            if (referenced) throw new Error(loc.no.admin.recycleBin.inUse)
          }
        }
        RecycleBinSource.checkLogicalDependents(request)
        db.delete(table).where(eq(table.id, request.id)).run()
      } else {
        RecycleBinSource.restore(request.table, request.id)
      }
      reconcile()
    })
  }

  private static checkLogicalDependents(request: RecycleRequest) {
    const slots = tables.tournamentMatchSlots
    const kinds: (typeof slots.$inferSelect.kind)[] = []
    if (request.table === 'users') kinds.push('player')
    if (request.table === 'tournamentGroups') kinds.push('group_rank')
    if (request.table === 'tournamentMatches')
      kinds.push('match_winner', 'match_loser')
    if (
      kinds.length &&
      db
        .select({ id: slots.id })
        .from(slots)
        .where(
          and(eq(slots.slotHolderId, request.id), inArray(slots.kind, kinds))
        )
        .get()
    )
      throw new Error(loc.no.admin.recycleBin.inUse)
    if (
      request.table === 'tracks' &&
      db
        .select({ id: tables.tournamentStages.id })
        .from(tables.tournamentStages)
        .where(
          sql`exists (select 1 from json_each(${tables.tournamentStages.tracks}) where value = ${request.id})`
        )
        .get()
    )
      throw new Error(loc.no.admin.recycleBin.inUse)
  }

  private static restore(name: RecycleTable, id: string) {
    const table = tables[name]
    for (const fk of getTableConfig(table).foreignKeys) {
      const reference = fk.reference()
      const parent = Object.values(tables).find(
        candidate => candidate === reference.foreignTable
      )
      if (!parent) continue
      const deletedParent = db
        .select({ id: parent.id })
        .from(parent)
        .where(
          and(
            isNotNull(parent.deletedAt),
            ...reference.foreignColumns.map((column, index) =>
              eq(
                column,
                sql`(select ${reference.columns[index]} from ${table} where ${table.id} = ${id})`
              )
            )
          )
        )
        .get()
      if (deletedParent) throw new Error(loc.no.admin.recycleBin.deletedParent)
    }
    if (name === 'tournamentMatchSlots') {
      const slot = db
        .select()
        .from(tables.tournamentMatchSlots)
        .where(eq(tables.tournamentMatchSlots.id, id))
        .get()
      if (!slot) throw new Error(loc.no.admin.recycleBin.missing)
      const parent = slotParent(slot.kind)
      const record = db
        .select({ deletedAt: parent.deletedAt })
        .from(parent)
        .where(eq(parent.id, slot.slotHolderId))
        .get()
      if (!record || record.deletedAt)
        throw new Error(loc.no.admin.recycleBin.deletedParent)
    }
    if (name === 'tournamentStages') {
      const stage = db
        .select()
        .from(tables.tournamentStages)
        .where(eq(tables.tournamentStages.id, id))
        .get()
      for (const trackId of stage?.tracks ?? []) {
        const track = db
          .select({ deletedAt: tables.tracks.deletedAt })
          .from(tables.tracks)
          .where(eq(tables.tracks.id, trackId))
          .get()
        if (!track || track.deletedAt)
          throw new Error(loc.no.admin.recycleBin.deletedParent)
      }
    }
    db.update(table).set({ deletedAt: null }).where(eq(table.id, id)).run()
    if (name === 'tournamentMatches') {
      const slots = db
        .select()
        .from(tables.tournamentMatchSlots)
        .where(eq(tables.tournamentMatchSlots.tournamentMatch, id))
        .all()
      if (slots.length !== 2) throw new Error(loc.no.admin.recycleBin.missing)
      for (const slot of slots)
        RecycleBinSource.restore('tournamentMatchSlots', slot.id)
    }
  }
}

function makeOtherItem(
  table: string,
  id: string,
  deletedAt: Date,
  label: string
): RecycleItem {
  switch (table) {
    case 'sessionSignups':
    case 'tournaments':
    case 'tournamentStages':
    case 'tournamentGroups':
    case 'tournamentPlayers':
    case 'tournamentMatches':
    case 'tournamentMatchSlots':
    case 'webhookCaptures':
    case 'webhookEvents':
      return { table, id, deletedAt, record: { id, label } }
    default:
      throw new Error('Unknown recycle table')
  }
}

function slotParent(
  kind: typeof tables.tournamentMatchSlots.$inferSelect.kind
) {
  if (kind === 'player') return tables.users
  if (kind === 'group_rank') return tables.tournamentGroups
  return tables.tournamentMatches
}
