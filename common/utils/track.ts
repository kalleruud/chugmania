import type { Track } from '../models/track'
export function formatTrackLabel(track: Pick<Track, 'name'>): string {
  return track.name
}
