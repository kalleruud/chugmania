export const no = {
  common: {
    loading: 'Laster inn…',
    saving: 'Lagrer…',
    cancel: 'Avbryt',
    submit: 'Send inn',
    save: 'Lagre',
    delete: 'Slett',
    edit: 'Rediger',
    create: 'Opprett',
    export: 'Eksporter',
    import: 'Importer',
    yes: 'Ja',
    no: 'Nei',
    maybe: 'Kanskje',
    signIn: 'Logg inn',
    signOut: 'Logg ut',
    signUp: 'Opprett konto',
    goBack: 'Tilbake',
  },

  pages: {
    home: {
      subtitle: 'Trackmania Turbo Lap Tracker',
      welcomeSignedOut: 'Velkommen til Chugmania',
      welcomeSignedIn: 'Tilbake i pitstallen',
      descriptionSignedIn:
        'Logget inn som {{signedInLabel}}. Administrer rundetidene dine, utforsk nye ledertavler, og hold forspranget.',
      descriptionSignedOut:
        'Logg rundetidene dine fra Trackmania Turbo, konkurrér på globale ledertavler, og overvåk hver forbedring.',
      viewTracks: 'Se baner',
      browseTracks: 'Utforsk baner',
    },

    login: {
      signUpHeading: 'Opprett konto',
      signInHeading: 'Logg inn',
      subtitle: 'Drivstoff inn i sesjonen og treff banen',
      toggleToSignUp: 'Ny sjåfør? Opprett en konto',
      toggleToSignIn: 'Allerede kjørende? Logg inn',
    },

    admin: {
      heading: 'Administratorkontroll',
      description:
        'Importer kuraterte CSV-eksporter fra datamappen for å fylle opp databasen.',
      importing: 'Importerer...',
      datasets: {
        users: {
          title: 'Brukere',
          description: 'Opprett eller oppdater sjåfører, roller og merker.',
        },
        tracks: {
          title: 'Baner',
          description: 'Håndter den offisielle banelisten og attributter.',
        },
        lapTimes: {
          title: 'Rundetider',
          description: 'Masseimporter historiske rundetider med kommentarer.',
        },
        sessions: {
          title: 'Sesjoner',
          description:
            'Masseimporter eller eksporter sesjon-møter og arrangement.',
        },
      },
      fileDropLabel: 'Slipp CSV her eller klikk for å velge',
      fileDropHint: 'Godtar *.csv-filer',
    },

    sessions: {
      heading: 'Sesjoner',
      description:
        'Delta på kommende Trackmania-sammenkomster. Moderatorer og administratorer oppretter sesjoner; alle kan RSVP.',
      signInToJoin: 'Logg inn for å delta.',
      deleteConfirmation: 'Slett denne sesjonen?',
      cancelConfirmation: 'Avbryt denne sesjonen?',
      noSessionsYet: 'Ingen sesjoner ennå.',
      subscribeViaCalendar: 'Abonner via kalender',
      createSessionSection: 'Opprett en sesjon',
      createSessionButton: 'Opprett sesjon',
      upcomingSessions: 'Kommende sesjoner',
      pastSessions: 'Tidligere sesjoner',
    },

    tracks: {
      heading: 'Baner',
    },

    players: {
      heading: 'Chugmania-stillinger',
      subtitle: 'Sjåførledertavle',
      description:
        'Rangert etter gjennomsnittlig posisjon på tvers av alle innsendte baner.',
      noPlayersYet: 'Ingen sjåfører registrert ennå.',
      columnRank: '#',
      columnPlayer: 'Sjåfør',
      columnAvgPosition: 'Gjenn.pos',
    },

    track: {
      loadingLeaderboard: 'Laster inn ledertavle…',
      errorCouldntGetTrack: 'Kunne ikke hente bane',
    },

    player: {
      missingPlayerIdentifier: 'Mangler sjåføridentifikator',
      dataUnavailable: 'Sjåførdata utilgjengelig.',
      detailsUpdated: 'Detaljer oppdatert.',
      thisIsYourProfile: 'Dette er profilen din',
      updateEmailWarning: 'Vennligst oppdater e-posten din før du fortsetter.',
      editDetails: 'Rediger detaljer',
      statsLabel: {
        tracks: 'Baner',
        lapTimes: 'Rundetider',
        totalEntries: 'Totale oppføringer:',
      },
      noLapTimesRecorded: 'Ingen rundetider registrert ennå.',
    },
  },

  components: {
    fileDrop: {
      defaultLabel: 'Slipp fil her eller klikk for å velge',
      errorMessage: 'Klarte ikke å lese fil',
      readingFile: 'Leser fil…',
    },

    lapTimeInput: {
      selectUser: 'Velg sjåfør',
      selectTrack: 'Velg bane',
      commentPlaceholder: 'Kommentar',
      sessionLinkPlaceholder: 'Lenke til sesjon (valgfritt)',
      noSessionsFound: 'Ingen sesjoner funnet',
      errorNoUserSelected: 'Ingen sjåfør valgt',
      errorNoTrackSelected: 'Ingen bane valgt',
      timeSeparator: ':',
      decimalSeparator: '.',
      minuteZeroPlaceholder: '0',
    },

    leaderboard: {
      noEntriesAvailable: 'Ingen oppføringer tilgjengelig',
    },

    searchableDropdown: {
      placeholder: 'Søk…',
      noResults: 'Ingen resultater',
    },

    sessionForm: {
      sessionNameLabel: 'Sesjonsnavn',
      sessionNamePlaceholder: 'Trackmania Turbo LAN',
      dateTimeLabel: 'Dato og tid',
      locationLabel: 'Lokasjon (valgfritt)',
      locationPlaceholder: 'Oslo, Norge',
      descriptionLabel: 'Beskrivelse (valgfritt)',
      descriptionPlaceholder: 'Del en kort agenda eller nyttige notater',
      loadingState: 'Laster inn…',
    },

    editSessionModal: {
      title: 'Rediger sesjon',
    },

    sessionCard: {
      status: {
        cancelled: 'Avbrutt',
        tentative: 'Tentativ',
        completed: 'Fullført',
        upcoming: 'Kommende',
      },
      signInToJoin: 'Logg inn for å delta',
    },

    timeEntryRow: {
      dnfLabel: 'DNF',
      gapType: {
        leader: 'LEDER',
        interval: 'INTERVALL',
      },
      toggleGapDisplayTitle: 'Veksle gapvisning',
    },

    userForm: {
      emailLabel: 'E-post',
      emailPlaceholder: 'du@eksempel.no',
      firstNameLabel: 'Fornavn',
      firstNamePlaceholder: 'Ola',
      lastNameLabel: 'Etternavn',
      lastNamePlaceholder: 'Normann',
      shortNameLabel: 'Kortnavn',
      shortNamePlaceholder: 'NOR',
      passwordLabel: 'Passord',
      currentPasswordLabel: 'Gjeldende passord',
      newPasswordLabel: 'Nytt passord',
      passwordPlaceholder: '••••••••',
    },
  },

  messages: {
    error: {
      generic: 'En feil oppstod',
      notFound: 'Ikke funnet',
      unauthorized: 'Ikke autorisert',
      forbidden: 'Forbudt',
      invalidRequest: 'Ugyldig forespørsel',
      failedToReadFile: 'Klarte ikke å lese fil',
      missingRequiredFields: 'Manglende påkrevde felt',
      invalidInput: 'Ugyldig inndata',
      networkError: 'Nettverksfeil',
      unknownError: 'Ukjent feil',
      permissionDenied: 'Du har ikke tillatelse til denne handlingen',
    },

    validation: {
      required: '{{field}} er påkrevd',
      invalid: '{{field}} er ugyldig',
      tooShort: '{{field}} må være minst {{min}} tegn',
      emailRequired: 'E-post er påkrevd',
      emailInvalid: 'E-posten er ugyldig',
      passwordRequired: 'Passord er påkrevd',
      passwordTooShort: 'Passord må være minst 6 tegn',
      notSelected: '{{item}} ikke valgt',
      sessionDateInvalid: 'Sesjonsdato er ugyldig',
      alreadyHappened: '{{action}} etter at sesjonen har funnet sted',
    },

    success: {
      generic: '{{action}} fullført',
      imported: 'Importerte {{imported}}/{{total}} {{table}} med suksess',
      saved: 'Lagret',
      sessionJoined: 'Du har påmeldt deg sesjonen',
    },

    info: {
      thisIsYourProfile: 'Dette er profilen din',
      noDataAvailable: 'Ingen data tilgjengelig',
      sessionPassed: 'Denne sesjonen har allerede funnet sted',
    },

    auth: {
      emailNotFound: 'E-post ikke funnet',
      incorrectPassword: 'Feil passord',
      userDoesNotExist: 'Bruker finnes ikke',
      missingEmailOrPassword: 'E-post eller passord mangler',
      roleNotAllowed: 'Rollen din {{role}} tillater ikke denne handlingen',
      notPermittedToUpdateUser:
        'Du har ikke tillatelse til å oppdatere denne brukeren',
      incorrectCurrentPassword: 'Gjeldende passord er feil',
      noJwtToken: 'Ingen JWT-token gitt',
      secretNotConfigured: "Miljøvariabel 'SECRET' er ikke konfigurert",
    },

    admin: {
      invalidCsvPayload: 'Ugyldig CSV-importforespørsel',
      invalidTable: 'Ugyldig tabell: {{table}}',
      invalidExportPayload: 'Ugyldig CSV-eksportforespørsel',
      noDataToExport: 'Ingen data å eksportere',
    },

    track: {
      noLeaderboards: 'Fant ingen ledertavler',
    },

    timeEntry: {
      invalidPostRequest: 'Ugyldig postforespørsel for rundetid',
      roleNotAllowed:
        'Rollen din {{role}} tillater ikke å poste rundetider for andre',
    },

    session: {
      invalidCreateRequest: 'Ugyldig opprettelsesforespørsel for sesjon',
      invalidUpdateRequest: 'Ugyldig oppdateringsforespørsel for sesjon',
      invalidDeleteRequest: 'Ugyldig slettingsforespørsel for sesjon',
      invalidCancelRequest: 'Ugyldig avbruddsforespørsel for sesjon',
      invalidSignupRequest: 'Ugyldig påmeldingsforespørsel for sesjon',
      notFound: 'Sesjon ikke funnet.',
      failedToProcess: 'Klarte ikke å {{action}} sesjon.',
    },
  },

  debug: {
    auth: {
      checkingAuth: 'Sjekker autentisering',
      loggingIn: '👤 Logging in:',
      checkingAuthFailed: 'Sjekking av autentisering mislyktes: {{error}}',
    },

    session: {
      noSessionsFound: 'SessionManager.getSessions - Ingen sesjoner funnet',
      sessionNotFound:
        'SessionManager.getSession - Sesjon ikke funnet {{sessionId}}',
      noSignupsFound:
        'SessionManager.getSessionSignups - Ingen påmeldinger funnet for sesjon {{sessionId}}',
      createdSession: 'Opprettet sesjon',
      deletedSession: 'Slettet sesjon',
      cancelledSession: 'Avbrutt sesjon',
      signedUpForSession: 'Påmeldt sesjon med respons: {{response}}',
      cancelledSessionSignup: 'Avmeldt sesjon',
      failedToBroadcastSessions: 'Klarte ikke å kringkaste sesjoner',
    },

    admin: {
      receivedCsvFile: 'Mottatt CSV-fil: {{table}}',
      exportingCsvTable: 'Eksporterer CSV-tabell: {{table}}',
    },

    track: {
      foundNoLeaderboards: 'Fant ingen ledertavler',
    },
  },
} as const
