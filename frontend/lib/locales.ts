import type { TrackLevel, TrackType } from '../../backend/database/schema'

export type Localization = typeof no
export type Locale = 'no'

const no = {
  tracks: {
    title: 'Baner',
    description: 'Oversikt over banetider per bane.',
    customDescription: 'Baner vi har laget selv.',
    level: {
      custom: 'Custom',
      white: 'White',
      green: 'Green',
      blue: 'Blue',
      red: 'Red',
      black: 'Black',
    } satisfies Record<TrackLevel, string>,
    type: {
      drift: 'Drift',
      valley: 'Valley',
      lagoon: 'Lagoon',
      stadium: 'Stadium',
    } satisfies Record<TrackType, string>,
  },
  noItems: ['Finner ikke 🥵', 'Her var det tomt...', 'Har du gått feil?'],
}

const loc: Record<Locale, Localization> = {
  no,
}

export default loc
