import { getRandomItem } from '@/app/utils/utils'
import type { GapType } from '@/components/timeentries/TimeEntryRow'
import type { ExportCsvRequest } from '@common/models/importCsv'
import type {
  EliminationType,
  MatchStage,
  MatchStatus,
  SessionResponse,
  SessionStatus,
  TournamentBracket,
  TrackLevel,
  TrackType,
  UserRole,
} from '../../backend/database/schema'

export type Localization = typeof no
export type Locale = 'no'

const no = {
  chugmania: 'Chugmania',
  admin: {
    title: 'Admin',
    description: 'Det som skjer i admin panelet, blir i admin panelet.',
    dropFiles: 'Drop it like it hot',
    import: 'Importer',
    export: 'Eksporter',
    selectFiles: 'Velg filer',
    tableManagement: 'Tabeller',
    exportRequest: {
      loading: 'Eksporterer...',
      success: 'Tabellen ble eksportert',
      error: (err: Error) => `Kunne ikke eksportere tabellen: ${err.message}`,
    },
    importRequest: {
      loading: 'Importer...',
      success: (file: string, created: number, updated: number) =>
        `Importerte filen '${file}', opprettet ${created} og oppdaterte ${updated}`,
      error: (err: Error) => `Kunne ikke importere tabellen: ${err.message}`,
    },
    tables: {
      sessionSignups: 'Sesssion Signups',
      sessions: 'Sessions',
      timeEntries: 'Rundetider',
      tracks: 'Baner',
      users: 'Spillere',
      matches: 'Matcher',
      tournaments: 'Turneringer',
      groups: 'Grupper',
      groupPlayers: 'Gruppespillere',
      tournamentMatches: 'Turneringsmatcher',
    } satisfies Record<ExportCsvRequest['table'], string>,
  },
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
    register: {
      title: 'Registrer',
      description: 'Lag din egen Chugmania-bruker',
      request: {
        loading: 'Registrerer...',
        success: 'Brukeren ble opprettet, prøv å logg inn!',
        error: (e: Error) => `Registrering feilet: ${e.message}`,
      },
    },
    logout: {
      title: 'Logg ut',
    },
    create: {
      title: 'Opprett spiller',
      description: 'Registrer en ny degenerate',
      request: {
        loading: 'Oppretter...',
        success: 'Spilleren ble opprettet!',
        error: (e: Error) => `Oppretting feilet: ${e.message}`,
      },
    },
    edit: {
      title: 'Rediger bruker',
      description: 'Gjør endringer til Chugmania brukeren.',
      request: {
        loading: 'Oppdaterer...',
        success: 'Brukeren ble endret!',
        error: (e: Error) => `Endring feilet: ${e.message}`,
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
    past: 'Tidligere sessions',
    all: 'Alle sessions',
    edit: 'Rediger session',
    delete: 'Slett session',
    location: 'Sted',
    date: 'Dato',
    time: 'Tid',
    attendees: 'Påmeldte',
    attendance: 'Påmelding',
    next: 'Neste session',
    form: {
      name: 'Navn',
      description: 'Beskrivelse',
      date: 'Dato og tid',
      location: 'Lokasjon',
      status: 'Status',
    },
    create: {
      title: 'Opprett session',
      description: 'Planlegg en ny sesh med degenerate decisions',
      request: {
        loading: 'Oppretter session...',
        success: 'Session opprettet',
        error: (err: Error) => `Feil ved opprettelse: ${err.message}`,
      },
    },
    editRequest: {
      loading: 'Rediger session...',
      success: 'Session endret',
      error: (err: Error) => `Feil ved endring: ${err.message}`,
    },
    statusOptions: {
      confirmed: 'Bekreftet',
      tentative: 'Usikkert',
      cancelled: 'Avlyst',
    } as Record<SessionStatus, string>,
    status: {
      past: 'Avsluttet',
      ongoing: 'Pågår',
      upcoming: 'Kommer',
    },
    rsvp: {
      change: 'Endre svar',
      responses: {
        yes: 'Skal',
        maybe: 'Skal kanskje',
        no: 'Skal ikke',
      } as Record<SessionResponse, string>,
      response: {
        loading: 'Svarer...',
        success: (response: SessionResponse) =>
          `Svar ble oppdatert: ${no.session.rsvp.responses[response]}`,
        error: (err: Error) => `Kunne ikke registrere svar: ${err.message}`,
      },
    },
    calendar: {
      subscribe: 'Abonner på kalender',
    },
    errorMessages: {
      no_edit_historical: 'Du kan ikke endre svar på en session tilbake i tid.',
    },
  },
  match: {
    cancel: 'Avlys',
    vs: 'vs',
    title: 'Matcher',
    description: '1v1 Konkurranser',
    edit: 'Rediger match',
    new: 'Ny match',
    noMatches: 'Ingen matcher funnet.',
    unknownUser: 'Ukjent',
    status: {
      planned: 'Planlagt',
      completed: 'Ferdig',
      cancelled: 'Avlyst',
    } as Record<MatchStatus, string>,
    stage: {
      group: 'Gruppespill',
      eight: 'Åttendelsfinale',
      quarter: 'Kvartfinale',
      semi: 'Semifinale',
      bronze: 'Bronsefinale',
      final: 'Finale',
      loser_eight: 'Taperåttendelsfinale',
      loser_quarter: 'Taperkvartfinale',
      loser_semi: 'Tapersemifinale',
      loser_bronze: 'Taperbronsefinale',
      loser_final: 'Taperfinale',
      grand_final: 'Grand finale',
    } as Record<MatchStage, string>,
    form: {
      user1: 'Spiller 1',
      user2: 'Spiller 2',
      track: 'Bane',
      session: 'Session',
      status: 'Status',
      winner: 'Vinner',
      stage: 'Nivå',
      comment: 'Kommentar',
    },
    placeholder: {
      selectUser1: 'Velg spiller 1',
      selectUser2: 'Velg spiller 2',
      selectTrack: 'Velg bane',
      selectSession: 'Velg session',
      selectWinner: 'Velg vinner',
      none: 'Ingen',
    },
    toast: {
      validationError: 'Du må fylle ut alle feltene...',
      create: {
        loading: 'Oppretter match...',
        success: 'Match opprettet!',
        error: 'Klarte ikke opprette match',
      },
      update: {
        loading: 'Oppdaterer match...',
        success: 'Match oppdatert!',
        error: 'Klarte ikke oppdatere match',
      },
      delete: {
        loading: 'Sletter match...',
        success: 'Match slettet!',
        error: 'Klarte ikke slette match',
      },
    },
    error: {
      planned_winner:
        'Du kan ikke sette en vinner på en match før den er ferdig.',
      invalid_winner: 'Vinneren må være en av deltakerne.',
      same_user: 'Begge deltakerne kan ikke være den samme spilleren.',
    },
  },
  tournament: {
    title: 'Turneringer',
    description: 'Single og Double Elimination turneringer',
    new: 'Ny turnering',
    edit: 'Rediger turnering',
    delete: 'Slett turnering',
    noTournaments: 'Ingen turneringer funnet.',
    groupStage: 'Gruppespill',
    bracket: 'Sluttspill',
    pending: 'Venter',
    matchName: (group: string, match: number) => `${group} Match ${match}`,
    groupName: (number: number) =>
      `Gruppe ${String.fromCodePoint(number + 65)}`,
    form: {
      name: 'Navn',
      session: 'Velg session',
      description: 'Beskrivelse',
      groupsCount: 'Antall grupper',
      groupsCountHint: (players: number) => `~${players} per gruppe`,
      advancementCount: 'Antall som går videre per gruppe',
      eliminationType: 'Type',
      groupStageTracks: 'Baner for gruppespill',
      groupStageTracksHint:
        'Velg en eller flere baner. Matcher fordeles jevnt.',
      bracketTracks: 'Baner for sluttspill',
      bracketTracksHint: 'Velg én bane for hver runde.',
      selectTrack: 'Velg bane',
      trackPerRound: 'Bane per runde i gruppespill',
      trackDistribution: (matches: number, tracks: number) =>
        `${matches} matcher fordelt på ${tracks} bane${tracks > 1 ? 'r' : ''} (~${Math.round(matches / tracks)} per bane)`,
      simulate: 'Simuler resultat',
      simulateHint: 'Genererer vinnere for alle matcher i turneringen.',
    },
    preview: {
      totalMatches: 'Totalt antall matcher',
      groups: 'Grupper',
      groupMatches: 'gruppespillmatcher',
      bracket: 'Sluttspill',
      bracketMatches: 'sluttspillmatcher',
      selectTracks: 'Velg baner',
    },
    eliminationType: {
      single: 'Single Elimination',
      double: 'Double Elimination',
    } as Record<EliminationType, string>,
    bracketType: {
      group: 'Gruppespill',
      upper: 'Upper Bracket',
      lower: 'Lower Bracket',
      grand_final: 'Grand Finale',
    } as Record<TournamentBracket, string>,
    toast: {
      create: {
        loading: 'Oppretter turnering...',
        success: 'Turnering opprettet!',
        error: (err: Error) => `Klarte ikke opprette turnering: ${err.message}`,
      },
      update: {
        loading: 'Oppdaterer turnering...',
        success: 'Turnering oppdatert!',
        error: (err: Error) =>
          `Klarte ikke oppdatere turnering: ${err.message}`,
      },
      delete: {
        loading: 'Sletter turnering...',
        success: 'Turnering slettet!',
        error: (err: Error) => `Klarte ikke slette turnering: ${err.message}`,
      },
    },
    source: {
      groupWinner: (group: string) => `Vinner ${group}`,
      groupRank: (group: string, rank: number) => `${rank}. plass ${group}`,
      matchWinner: (match: string) => `Vinner ${match}`,
      matchLoser: (match: string) => `Taper ${match}`,
    },
    roundName: (size: number, isLower: boolean) => {
      const prefix = isLower ? 'Taper ' : ''
      if (size === 2) return `${prefix}Finale`
      if (size === 4) return `${prefix}Semifinale`
      if (size === 8) return `${prefix}Kvartfinale`
      if (size === 16) return `${prefix}Åttendelsfinale`
      return `${prefix}Runde ${size}`
    },
    bracketRoundName: (
      bracket: TournamentBracket,
      round: number,
      groupName?: string
    ) => {
      if (bracket === 'grand_final') return 'Grand Finale'
      if (bracket === 'group')
        return groupName ? `${groupName} Runde ${round}` : `Runde ${round}`

      const prefix = bracket === 'lower' ? 'Taper ' : ''
      if (round === 1) return `${prefix}Finale`
      if (round === 2) return `${prefix}Semifinale`
      if (round === 3) return `${prefix}Kvartfinale`
      return `${prefix}Runde ${round}`
    },
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
      loser_not_found:
        'Taper mangler! Matchen har fått en vinner selv om ikke to spillere var involvert.',
      session_not_selected:
        'Du må velge en session, vennligst ikke reproduser.',
      update_email: 'Du må oppdatere e-post og passord før du kan gjøre noe.',
      missing_files: 'Du har ikke valgt noen filer',
      missing_data: 'Ingen data ble sendt',
      missing_jwt: 'Du har ingen JWT token... Går det an å være mer idiot?',
      incorrect_login: 'Brukernavn eller passord er feil, prøv igjen.',
      missing_login: 'Enten brukernavn eller passord mangler...',
      db_failed: 'Databasen sa nei',
      incorrect_password:
        'Passordet er feil... Det er lov å ikke være tilbakestående',
      insufficient_permissions:
        'Du får ikke lov til å gjøre dette din hårete faen.',
      invalid_jwt:
        'Jeg vet ikke hvordan du har fått til dette, men jwt-en din inneholder ikke brukerdata...',
      connection_failed: (error: Error) =>
        `Klarer ikke koble til Svetlana '${error.name} - ${error.message}'`,
      not_in_db: (item: string) => `Fant ikke '${item}' på mainframen`,
      unknown_error: 'Ngl, jeg aaner ikke hva som skjedde her...',
      invalid_request: (type: string) =>
        `Svetlana mottok noe søppel av en '${type}' som gir null mening, prøv igjen.`,
      email_already_exists:
        'E-posten er allerede registrert, prøv med en annen mail din idiot.',
      update_failed: 'Oppdatering feilet, prøv igjen.',
    },
  },
  timeEntry: {
    title: 'Rundetider',
    receivedUpdate: 'Rundetidene ble oppdatert',
    dnf: 'DNF',
    gap: {
      leader: 'Leader',
      interval: 'Interval',
    } as Record<GapType, string>,
    input: {
      validationError: 'Du må fylle ut alle feltene...',
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
    confirm: 'Sikker?',
    now: 'Nå',
    new: 'Ny',
    edit: 'Rediger',
    delete: 'Slett',
    save: 'Lagre',
    showAll: 'Vis alle',
    show: 'Vis',
    hide: 'Skjul',
    home: 'Hjem',
    continue: 'Kjør',
    back: 'Tilbake',
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
    noItems: getRandomItem([
      'Det finnes ikke en dritt her 🥵',
      'Her var det tomt...',
      'Har du gått feil?',
    ]),
  },
} as const

const loc: Record<Locale, Localization> = {
  no,
}

export default loc
