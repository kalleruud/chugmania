import { getRandomItem } from '@/app/utils/utils'
import type { GapType } from '@/components/timeentries/TimeEntryItem'
import type {
  TrackLevel,
  TrackType,
  UserRole,
} from '../../backend/database/schema'

export type Localization = typeof no
export type Locale = 'no'

const no = {
  user: {
    notLoggedIn: 'Du er ikke logget inn',
    joined: 'Chugget siden',
    login: {
      title: 'Logg inn',
      description: 'Logg inn for å registrere tider og meld deg på sessions.',
      request: {
        loading: 'Logger inn...',
        success: 'Logget inn!',
        error: (e: Error) => `Innlogging feilet: ${e.message}`,
      },
    },
    logout: {
      title: 'Logg ut',
    },
    edit: {
      title: 'Rediger bruker',
      description: 'Gjør endringer til Chugmania brukeren.',
      request: {
        loading: 'Oppdaterer...',
        success: 'Brukeren ble endret!',
        error: (e: Error) => `Oppdatering feilet: ${e.message}`,
      },
    },
    form: {
      email: 'E-post',
      firstName: 'Fornavn',
      lastName: 'Etternavn',
      shortName: 'Visningsnavn',
      password: 'Passord',
      oldPassword: 'Gammelt passord',
      newPassword: 'Nytt passord',
      role: 'Rolle',
      advanced: 'Avansert',
      createdAt: 'Opprettet dato',
    },
    role: {
      user: 'Spiller',
      moderator: 'Moderator',
      admin: 'Admin',
    } as Record<UserRole, string>,
  },
  session: {
    title: 'Sessions',
    description: 'Oversikt over kommende og tidligere sessions.',
    upcoming: 'Kommende sessions',
    past: 'Tidligere sessions',
    all: 'Alle sessions',
    create: 'Opprett session',
    edit: 'Rediger session',
    delete: 'Slett session',
    location: 'Sted',
    date: 'Dato',
    time: 'Tid',
    attendees: 'Påmeldte',
    rsvp: {
      title: 'Meld deg på',
      yes: 'Kommer',
      maybe: 'Kanskje',
      no: 'Kommer ikke',
      change: 'Endre svar',
    },
    calendar: {
      subscribe: 'Abonner på kalender',
    },
    errorMessages: {
      no_edit_historical: 'Du kan ikke svare på en session tilbake i tid.',
    },
  },
  dialog: {
    confirmDelete: {
      title: 'Bekreft sletting',
      description: 'Er du heeelt sikker?',
    },
    confirm: {
      title: 'Bekreft',
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
    description: getRandomItem([
      'Nå har du faen meg rota det til... Skjerpings!',
      'Hvordan har du fått til dette da?',
      'Du en er skuffelse for familien din og alle i verden hater deg.',
      'Nå dreit du deg ut',
      'Dumme faen',
      'Nå tisset du på leggen',
      'Straffeshot på deg!',
    ]),
    retryAction: 'Gå tilbake',
    messages: {
      missing_data: 'Ingen data ble sendt',
      missing_jwt: 'Du har ingen JWT token... Går det an å være mer idiot?',
      incorrect_login: 'Brukernavn eller passord er feil, prøv igjen.',
      missing_login: 'Enten brukernavn eller passord mangler...',
      incorrect_password:
        'Passordet er feil... Det er lov å ikke være tilbakestående',
      insufficient_permissions:
        'Du får ikke lov til å gjøre dette din hårete faen.',
      invalid_jwt:
        'Jeg vet ikke hvordan du har fått til dette, men jwt tokenen inneholder ikke brukerdata...',
      connection_failed: (error: Error) =>
        `Klarer ikke koble til Svetlana '${error.name} - ${error.message}'`,
      not_in_db: (item: string) => `Fant ikke '${item}' på mainframen`,
      unknown_error: 'Ngl, jeg aaner ikke hva som skjedde her...',
      invalid_request: (type: string) =>
        `Svetlana mottok noe søppel av en '${type}' som gir null mening, prøv igjen.`,
    },
  },
  timeEntry: {
    receivedUpdate: 'Rundetidene ble oppdatert',
    gap: {
      leader: 'Leader',
      interval: 'Interval',
    } as Record<GapType, string>,
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
      noChanges: 'Du har ikke gjort noen endringer...',
      fieldName: {
        comment: 'Kommentar',
      },
      placeholder: {
        track: 'Velg bane',
        user: 'Velg spiller',
        session: 'Velg session',
        comment: 'Chugga dårligere enn bestemoren min...',
      },
      createRequest: {
        loading: 'Registrerer rundetiden',
        success: (laptime: string) => `Rundetiden ble registrert: ${laptime}`,
        error: (err: Error) =>
          `Kunne ikke registrere rundetiden: ${err.message}`,
      },
      editRequest: {
        loading: 'Endrer rundetiden',
        success: 'Rundetiden ble endret',
        error: (err: Error) => `Endring feilet: ${err.message}`,
      },
      deleteRequest: {
        loading: 'Sletter rundetiden',
        success: 'Rundetiden ble slettet',
        error: (err: Error) => `Sletting feilet: ${err.message}`,
      },
    },
  },
  tracks: {
    title: 'Baner',
    description: 'Oversikt over banetider per bane.',
    customDescription: 'Baner vi har laget selv.',
    receivedUpdate: 'Banene ble oppdatert',
    level: {
      custom: 'Custom',
      white: 'White',
      green: 'Green',
      blue: 'Blue',
      red: 'Red',
      black: 'Black',
    } as Record<TrackLevel, string>,
    type: {
      drift: 'Drift',
      valley: 'Valley',
      lagoon: 'Lagoon',
      stadium: 'Stadium',
    } as Record<TrackType, string>,
  },
  users: {
    title: 'Spillere',
    description: 'Oversikt over alle spillere.',
    receivedUpdate: 'Spillerne ble oppdatert',
  },
  common: {
    new: 'Ny',
    edit: 'Rediger',
    delete: 'Slett',
    save: 'Lagre',
    cancel: 'Avbryt',
    showAll: 'Vis alle',
    show: 'Vis',
    hide: 'Skjul',
    home: 'Hjem',
    noItems: getRandomItem([
      'Finner ikke 🥵',
      'Her var det tomt...',
      'Har du gått feil?',
    ]),
  },
} as const

const loc: Record<Locale, Localization> = {
  no,
}

export default loc
