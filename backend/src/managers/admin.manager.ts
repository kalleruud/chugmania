import { eq } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import {
  isImportCsvRequest,
  type ImportCsvRequest,
} from '../../../common/models/requests'
import type {
  BackendResponse,
  ImportCsvResponse,
} from '../../../common/models/responses'
import { TRACK_LEVELS, TRACK_TYPES } from '../../../common/models/track'
import db from '../../database/database'
import {
  timeEntries,
  tracks,
  users,
  type TrackLevel,
  type TrackType,
  type UserRole,
} from '../../database/schema'
import AuthManager from './auth.manager'

type ImportSummary = ImportCsvResponse['summary']

type CsvRecord = Record<string, string>

const DEFAULT_AMOUNT = 0.5

export default class AdminManager {
  static async onImportCsv(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isImportCsvRequest(request))
      throw Error('Invalid CSV import request payload')

    const { data: user, error } = await AuthManager.checkAuth(socket)
    if (error)
      return {
        success: false,
        message: error.message,
      }

    if (user.role !== 'admin')
      return {
        success: false,
        message: 'Only admins can import CSV data.',
      }

    const records = AdminManager.parseCsv(request)
    if (records.length === 0)
      return {
        success: true,
        summary: {
          target: request.target,
          inserted: 0,
          updated: 0,
          skipped: 0,
        },
      } satisfies ImportCsvResponse

    let summary: ImportSummary
    switch (request.target) {
      case 'users':
        summary = await AdminManager.importUsers(records)
        break
      case 'tracks':
        summary = await AdminManager.importTracks(records)
        break
      case 'timeEntries':
        summary = await AdminManager.importTimeEntries(records)
        break
      default:
        throw Error(`Unsupported CSV import target: ${request.target}`)
    }

    return {
      success: true,
      summary,
    } satisfies ImportCsvResponse
  }

  private static removeBom(value: string) {
    return value.startsWith('\ufeff') ? value.slice(1) : value
  }

  private static splitCsv(content: string) {
    const cleaned = AdminManager.removeBom(content)
    const rows: string[][] = []
    let currentValue = ''
    let currentRow: string[] = []
    let insideQuotes = false

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned.charAt(i)

      if (char === '"') {
        const next = cleaned.charAt(i + 1)
        if (insideQuotes && next === '"') {
          currentValue += '"'
          i++
        } else {
          insideQuotes = !insideQuotes
        }
        continue
      }

      if (char === ',' && !insideQuotes) {
        currentRow.push(currentValue)
        currentValue = ''
        continue
      }

      if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && cleaned[i + 1] === '\n') i++
        currentRow.push(currentValue)
        currentValue = ''
        if (currentRow.some(v => v.trim() !== '')) rows.push(currentRow)
        currentRow = []
        continue
      }

      currentValue += char
    }

    if (insideQuotes)
      throw Error('CSV parse error: unterminated quoted value encountered')

    if (currentValue.length > 0 || currentRow.length > 0) {
      currentRow.push(currentValue)
      if (currentRow.some(v => v.trim() !== '')) rows.push(currentRow)
    }

    return rows
  }

  private static parseCsv(request: ImportCsvRequest): CsvRecord[] {
    const rows = AdminManager.splitCsv(request.content)
    if (rows.length === 0) return []

    const headers = rows[0]!.map(header => header.trim())
    const dataRows = rows.slice(1)

    return dataRows
      .map(row => {
        const record: CsvRecord = {}
        headers.forEach((header, index) => {
          if (!header) return
          record[header] = (row[index] ?? '').trim()
        })
        return record
      })
      .filter(record =>
        Object.values(record).some(v => v !== undefined && v.trim() !== '')
      )
  }

  private static createSummary(target: ImportSummary['target']): ImportSummary {
    return { target, inserted: 0, updated: 0, skipped: 0 }
  }

  private static warnSkip(
    target: ImportSummary['target'],
    reason: string,
    record: CsvRecord
  ) {
    console.warn(
      new Date().toISOString(),
      `[import:${target}] skipped row - ${reason}`,
      record
    )
  }

  private static normalizeString(value: string | undefined) {
    const trimmed = value?.trim()
    return trimmed && trimmed.length > 0 ? trimmed : undefined
  }

  private static normalizeEmail(value: string | undefined) {
    const normalized = AdminManager.normalizeString(value)
    return normalized?.toLowerCase()
  }

  private static normalizeId(value: string | undefined) {
    const normalized = AdminManager.normalizeString(value)
    return normalized && normalized.length > 0 ? normalized : undefined
  }

  private static toUpperOrNull(value: string | undefined) {
    const normalized = AdminManager.normalizeString(value)
    return normalized ? normalized.toUpperCase() : null
  }

  private static parseInt(value: string | undefined) {
    const normalized = AdminManager.normalizeString(value)
    if (!normalized) return null
    const parsed = Number.parseInt(normalized, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  private static parseFloat(value: string | undefined) {
    const normalized = AdminManager.normalizeString(value)
    if (!normalized) return null
    const parsed = Number.parseFloat(normalized)
    return Number.isNaN(parsed) ? null : parsed
  }

  private static async importUsers(records: CsvRecord[]) {
    const summary = AdminManager.createSummary('users')

    if (records.length === 0) return summary

    const existingUsers = await db.select().from(users)
    const byEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u]))

    for (const record of records) {
      const email = AdminManager.normalizeEmail(record.email)
      const name = AdminManager.normalizeString(record.name)
      const password = AdminManager.normalizeString(record.password)

      if (!email || !name || !password) {
        summary.skipped += 1
        AdminManager.warnSkip(
          'users',
          'missing email, name, or password',
          record
        )
        continue
      }

      const shortName = AdminManager.toUpperOrNull(record.shortName)
      const role = AdminManager.parseRole(record.role)
      if (!role) {
        summary.skipped += 1
        AdminManager.warnSkip('users', 'invalid role', record)
        continue
      }

      const passwordHash = await AuthManager.hashPassword(password)
      const existing = byEmail.get(email)

      if (existing) {
        await db
          .update(users)
          .set({
            name,
            shortName,
            passwordHash,
            role,
          })
          .where(eq(users.id, existing.id))
        byEmail.set(email, {
          ...existing,
          name,
          shortName,
          passwordHash,
          role,
        })
        summary.updated += 1
        continue
      }

      const id = AdminManager.normalizeId(record.id)
      const inserted = await db
        .insert(users)
        .values({
          id,
          email,
          name,
          shortName,
          passwordHash,
          role,
        })
        .returning()

      summary.inserted += 1
      const persisted = inserted[0]
      if (persisted) byEmail.set(email, persisted)
    }

    return summary
  }

  private static parseRole(role: string | undefined): UserRole | null {
    if (!role || role.trim() === '') return 'user'
    const normalized = role.trim().toLowerCase()
    if (
      normalized === 'admin' ||
      normalized === 'moderator' ||
      normalized === 'user'
    )
      return normalized
    return null
  }

  private static async importTracks(records: CsvRecord[]) {
    const summary = AdminManager.createSummary('tracks')

    if (records.length === 0) return summary

    const existingTracks = await db.select().from(tracks)
    const byId = new Map(existingTracks.map(t => [t.id, t]))

    for (const record of records) {
      const trackNumber = AdminManager.parseInt(record.number)
      const level = AdminManager.parseLevel(record.level)
      const type = AdminManager.parseType(record.type)
      if (trackNumber === null || !level || !type) {
        summary.skipped += 1
        AdminManager.warnSkip(
          'tracks',
          'invalid number, level, or type',
          record
        )
        continue
      }

      const id = AdminManager.normalizeId(record.id)
      if (id && byId.has(id)) {
        await db
          .update(tracks)
          .set({
            number: trackNumber,
            level,
            type,
          })
          .where(eq(tracks.id, id))
        const existing = byId.get(id)
        if (existing)
          byId.set(id, {
            ...existing,
            number: trackNumber,
            level,
            type,
          })
        summary.updated += 1
        continue
      }

      const inserted = await db
        .insert(tracks)
        .values({
          id,
          number: trackNumber,
          level,
          type,
        })
        .returning()

      summary.inserted += 1
      const persisted = inserted[0]
      if (persisted) byId.set(persisted.id, persisted)
    }

    return summary
  }

  private static parseLevel(level: string | undefined): TrackLevel | null {
    if (!level) return null
    const normalized = level.trim().toLowerCase() as TrackLevel
    return TRACK_LEVELS.includes(normalized) ? normalized : null
  }

  private static parseType(type: string | undefined): TrackType | null {
    if (!type) return null
    const normalized = type.trim().toLowerCase() as TrackType
    return TRACK_TYPES.includes(normalized) ? normalized : null
  }

  private static async importTimeEntries(records: CsvRecord[]) {
    const summary = AdminManager.createSummary('timeEntries')

    if (records.length === 0) return summary

    const userIds = new Set(
      (await db.select({ id: users.id }).from(users)).map(u => u.id)
    )
    const trackIds = new Set(
      (await db.select({ id: tracks.id }).from(tracks)).map(t => t.id)
    )

    const values: (typeof timeEntries.$inferInsert)[] = []

    for (const record of records) {
      const userId = record.user
      const trackId = record.track
      const duration = AdminManager.parseInt(record.duration ?? record.ms)
      const amountValue =
        AdminManager.parseFloat(record.amount) ?? DEFAULT_AMOUNT
      if (
        !userId ||
        !trackId ||
        !userIds.has(userId) ||
        !trackIds.has(trackId)
      ) {
        summary.skipped += 1
        AdminManager.warnSkip(
          'timeEntries',
          'missing or unknown user/track id',
          record
        )
        continue
      }

      if (duration === null || duration <= 0) {
        summary.skipped += 1
        AdminManager.warnSkip('timeEntries', 'invalid duration', record)
        continue
      }

      const createdAt = AdminManager.toDate(record.date)
      const comment = AdminManager.normalizeString(record.comment)

      values.push({
        user: userId,
        track: trackId,
        duration,
        amount: Number.isFinite(amountValue) ? amountValue : DEFAULT_AMOUNT,
        comment,
        createdAt,
        updatedAt: createdAt,
      })
    }

    if (values.length > 0) {
      await db.insert(timeEntries).values(values)
      summary.inserted = values.length
    }

    return summary
  }

  private static toDate(value: string | undefined) {
    const timestamp = AdminManager.parseInt(value)
    if (timestamp === null) return new Date()
    const date = new Date(timestamp)
    return Number.isNaN(date.valueOf()) ? new Date() : date
  }
}
