import loc from '@common/locale/locales'
import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  getTrackName,
  isEditTrackRequest,
  isImportTrackRequest,
  MAX_TRACK_NICKNAME_LENGTH,
  type Track,
} from '@common/models/track'
import TrackSource from '../../database/sources/track.source'
import { broadcast, type TypedSocket } from '../server'
import { fetchTrackFromLink, type TrackMetadata } from '../utils/track-links'
import { fetchNextMapId } from '../utils/trackmania-io'
import AuthManager from './auth.manager'

export default class TrackManager {
  static readonly table = TrackSource.table

  static import = TrackSource.import
  static getTrackIdsWithLapTimes = TrackSource.getTrackIdsWithLapTimes

  static async getAllTracks(): Promise<Track[]> {
    const data = await TrackSource.getAll()

    if (data.length === 0) {
      console.debug(
        new Date().toISOString(),
        loc.no.error.messages.not_in_db(loc.no.tracks.title)
      )
      return []
    }

    return data
  }

  static async resolveNextMapId(track: Track) {
    if (track.game !== 'next' || !track.uid) return
    const mapId = await fetchNextMapId(track.uid)
    if (!mapId) return
    TrackSource.update(track.id, { mapId })
    broadcast('all_tracks', await TrackManager.getAllTracks())
  }

  private static saveImported(metadata: TrackMetadata): Track {
    const existing = TrackSource.findByUidIncludingDeleted(metadata.uid)
    if (existing && !existing.deletedAt)
      throw new Error(
        loc.no.tracks.import.alreadyExists(getTrackName(existing))
      )
    if (existing)
      return TrackSource.update(existing.id, { ...metadata, deletedAt: null })

    const unlinked =
      metadata.level === 'custom'
        ? undefined
        : TrackSource.findUnlinkedByName(metadata.game, metadata.name)
    if (unlinked) return TrackSource.update(unlinked.id, metadata)

    return TrackSource.create(metadata)
  }

  static async onEditTrack(
    socket: TypedSocket,
    request: EventReq<'edit_track'>
  ): Promise<EventRes<'edit_track'>> {
    if (!isEditTrackRequest(request))
      throw new Error(loc.no.error.messages.invalid_request('EditTrackRequest'))

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const nickname = request.nickname?.trim() || null
    if (nickname && nickname.length > MAX_TRACK_NICKNAME_LENGTH)
      throw new Error(loc.no.tracks.nickname.tooLong(MAX_TRACK_NICKNAME_LENGTH))
    if (!TrackSource.getActiveById(request.id))
      throw new Error(loc.no.error.messages.not_in_db(request.id))

    const track = TrackSource.update(request.id, { nickname })
    broadcast('all_tracks', await TrackManager.getAllTracks())
    return { success: true, track }
  }

  static async onImportTrack(
    socket: TypedSocket,
    request: EventReq<'import_track'>
  ): Promise<EventRes<'import_track'>> {
    if (!isImportTrackRequest(request))
      throw new Error(
        loc.no.error.messages.invalid_request('ImportTrackRequest')
      )

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const metadata = await fetchTrackFromLink(request.url)
    const track = TrackManager.saveImported(metadata)

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Imported track',
      track.name,
      request.url
    )

    broadcast('all_tracks', await TrackManager.getAllTracks())
    return { success: true, track }
  }
}
