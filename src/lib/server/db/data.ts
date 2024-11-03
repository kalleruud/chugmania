import { tracks, type TrackLevel, type TrackType } from './schema'

type Track = typeof tracks.$inferInsert

export function generateTracks(): Track[] {
  const trackCount = 200
  const tracks = []

  const levels: TrackLevel[] = ['white', 'green', 'blue', 'red', 'black']
  const types: TrackType[] = ['drift', 'valley', 'lagoon', 'stadium']

  for (let i = 0; i < trackCount; i++) {
    tracks.push({
      name: `#${(i + 1).toString().padStart(2, '0')}`,
      level: levels[Math.floor(i / 40) % levels.length],
      type: types[Math.floor(i / 10) % types.length],
    })
  }

  return tracks
}
