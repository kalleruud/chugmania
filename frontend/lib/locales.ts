import { getRandomItem } from '@/app/utils/utils'
import type { GapType } from '@/components/timeentries/TimeEntryItem'
import type { TrackLevel, TrackType } from '../../backend/database/schema'

export type Localization = typeof no
export type Locale = 'no'

const no = {
  login: {
    title: 'Logg inn',
    description: 'Logg inn for å registrere tider og meld deg på sessions.',
    notLoggedIn: 'Du er ikke logget inn',
    request: {
      loading: 'Logger inn...',
      success: 'Logget inn!',
      error: (e: Error) => `Innlogging feilet: ${e.message}`,
    },
    response: {
      incorrectLogin: 'Brukernavn eller passord er feil, prøv igjen.',
      missingLogin: 'Enten brukernavn eller passord mangler...',
    },
  },
  timeEntry: {
    gap: {
      leader: 'Leader',
      interval: 'Interval',
    } satisfies Record<GapType, string>,
    input: {
      create: {
        title: 'Registrer tid',
        description: 'Tiden din publiseres asap zulu.',
      },
      edit: {
        title: 'Rediger tid',
        description: 'Du gjør nå endringer på en eksisterende tid.',
      },
      submit: getRandomItem(['Yeeeehaw', 'Jeg elsker øl!', 'Registrer']),
      update: 'Oppdater',
      noUser: 'Du må velge en bruker, idiot!',
      noTrack: 'Du må velge en bane, din bøtte!',
      fieldName: {
        comment: 'Kommentar',
      },
      placeholder: {
        track: 'Velg bane',
        user: 'Velg spiller',
        session: 'Velg session',
        comment: 'Chugga dårligere enn bestemoren min...',
      },
      request: {
        loading: 'Publiserer rundetiden',
        success: (laptime: string) => `Rundetiden ble registrert: ${laptime}`,
      },
    },
  },
  dialog: {
    confirmDelete: {
      title: 'Bekreft sletting',
      description: 'Er du heeelt sikker?',
    },
    cancel: getRandomItem([
      'Abort mission',
      'Avbryt',
      'Cap',
      'Føkk dette',
      'Nah',
      'Jeg ombestemte meg',
      'Regretti spaghetti',
      'Vil ikke',
    ]),
    continue: 'Kjør',
    delete: 'Slett',
  },
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
  noItems: getRandomItem([
    'Finner ikke 🥵',
    'Her var det tomt...',
    'Har du gått feil?',
  ]),
  home: 'Hjem',
}

const loc: Record<Locale, Localization> = {
  no,
}

export default loc
