import type { TrackLevel, TrackType } from '../../backend/database/schema'

export type Localization = typeof no
export type Locale = 'no'

const no = {
  timeEntryInput: {
    title: 'Registrer tid',
    description: 'Tiden din publiseres asap zulu.',
    submit: ['Yeeeehaw', 'Jeg elsker øl!', 'Registrer'],
    noUser: 'Du må velge en bruker, idiot!',
    noTrack: 'Du må velge en bane, din bøtte!',
    request: {
      loading: 'Publiserer rundetiden',
      success: (laptime: string) => `Rundetiden ble registrert: ${laptime}`,
    },
  },
  cancel: [
    'Abort mission',
    'Avbryt',
    'Cap',
    'Føkk dette',
    'Nah',
    'Ombestemte meg',
    'Vil ikke',
  ],
  error: {
    title: 'Noe gikk galt 🥵',
    descriptions: [
      'Nå har du faen meg rota det til... Skjerpings!',
      'Hvordan har du fått til dette da?',
      'Du en er skuffelse for familien din og alle i verden hater deg.',
      'Nå dreit du deg ut',
      'Dumme faen',
      'Nå tisset du på leggen',
      'Straffeshot på deg!',
    ],
    retryAction: 'Gå tilbake',
  },
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
