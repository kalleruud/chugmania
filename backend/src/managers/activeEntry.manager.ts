import loc from '@common/locale/locales'
import {
  isSetActiveEntryRequest,
  type ActiveEntryOverrides,
  type EntryRef,
} from '@common/models/activeEntry'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { isUnplayed } from '@common/utils/activeEntry'
import { isInactiveFinalReset } from '@common/utils/tournament'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'

export default class ActiveEntryManager {
  private static readonly overrides = new Map<string, EntryRef>()

  static getOverrides(): ActiveEntryOverrides {
    return Object.fromEntries(ActiveEntryManager.overrides)
  }

  private static async isSelectable(
    session: string,
    entry: EntryRef
  ): Promise<boolean> {
    if (entry.kind === 'match') {
      const match = (await MatchManager.getAllMatches()).find(
        match => match.id === entry.id
      )
      return (
        !!match &&
        match.session === session &&
        isUnplayed(match) &&
        !isInactiveFinalReset(match)
      )
    }
    const timeEntry = (await TimeEntryManager.getAllTimeEntries()).find(
      timeEntry => timeEntry.id === entry.id
    )
    return !!timeEntry && timeEntry.session === session && isUnplayed(timeEntry)
  }

  static async onSetActiveEntry(
    socket: TypedSocket,
    request: EventReq<'set_active_entry'>
  ): Promise<EventRes<'set_active_entry'>> {
    if (!isSetActiveEntryRequest(request))
      throw new Error(
        loc.no.error.messages.invalid_request('SetActiveEntryRequest')
      )
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const session = await SessionManager.getSession(request.session)
    if (!session || session.status === 'cancelled')
      throw new Error(loc.no.error.messages.not_in_db(request.session))

    if (request.entry) {
      if (!(await ActiveEntryManager.isSelectable(session.id, request.entry)))
        throw new Error(loc.no.activeEntry.error.notSelectable)
      ActiveEntryManager.overrides.set(session.id, request.entry)
    } else {
      ActiveEntryManager.overrides.delete(session.id)
    }

    broadcast('active_entry_overrides', ActiveEntryManager.getOverrides())
    return { success: true }
  }
}
