import loc from '@common/locale/locales'
import type { Track } from '@common/models/track'
import TrackSource from '../../database/sources/track.source'
import { broadcast } from '../server'
import { fetchNextMapId } from '../utils/trackmania-io'

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
}
