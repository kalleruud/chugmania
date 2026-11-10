import loc from '@common/locale/locales'
import type { Track } from '@common/models/track'
import TrackSource from '../../database/track.source'

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
}
