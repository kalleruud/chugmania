import type { Leaderboard } from '@chugmania/common/models/leaderboard.js'
import type {
  BackendResponse,
  GetLeaderboardsResponse,
} from '@chugmania/common/models/responses.js'
import type { Track } from '@chugmania/common/models/track.js'
import db from '@database/database'
import { tracks } from '@database/schema'
import type { Socket } from 'socket.io'

export default class LeaderboardManager {
  private static async getLeaderboard(
    trackId: Track['id'],
    offset = 0,
    limit = 100
  ): Promise<Leaderboard> {
    // TODO: Implement leaderboard retrieval
  }

  private static async getLeaderboardSummaries(
    offset = 0,
    limit = 100
  ): Promise<Leaderboard[]> {
    // TODO: Implement leaderboard summary retrieval (top 3 leaderboard entries)
  }

  static async onGetLeaderboardSummaries(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    const trackIds = await db.select({ id: tracks.id }).from(tracks)

    return {
      success: true,
      leaderboards: await Promise.all(
        trackIds.map(tid => this.getLeaderboard(tid.id, 0, 3))
      ),
    } satisfies GetLeaderboardsResponse
  }

  static async onGetLeaderboard(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    return {
      success: true,
      leaderboards: [await this.getLeaderboard(trackId, 0, 100)],
    } satisfies GetLeaderboardsResponse
  }
}
