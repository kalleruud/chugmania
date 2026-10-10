import type { Track } from '../models/track'
export function formatTrackName(num: number): string {
  return String(num).padStart(2, '0')
}

export function formatTrackLabel(
  track: Pick<Track, 'number' | 'name'>
): string {
  return track.number === null
    ? (track.name ?? 'Unnamed track')
    : '#' + formatTrackName(track.number)
}
