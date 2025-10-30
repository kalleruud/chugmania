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
    button: {
      submit: 'Send inn',
      save: 'Lagre endringer',
      cancel: 'Avbryt',
      signIn: 'Logg inn',
      signOut: 'Logg ut',
      signUp: 'Opprett konto',
      goBack: 'Tilbake',
      viewTracks: 'Se baner',
      browseTracks: 'Utforsk baner',
      rsvpYes: 'Ja',
      rsvpMaybe: 'Kanskje',
      rsvpNo: 'Nei',
      createSession: 'Opprett sesjon',
      subscribeViaCalendar: 'Abonner via kalender',
    },

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
      submitButton: 'Send inn',
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
      cancelButton: 'Avbryt',
    },

    editSessionModal: {
      title: 'Rediger sesjon',
      submitLabel: 'Lagre endringer',
    },

    sessionCard: {
      status: {
        cancelled: 'Avbrutt',
        tentative: 'Tentativ',
        completed: 'Fullført',
        upcoming: 'Kommende',
      },
      rsvpButtons: {
        yes: 'Ja',
        maybe: 'Kanskje',
        no: 'Nei',
        signInToJoin: 'Logg inn for å delta',
      },
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
      submitLabelSignIn: 'Logg inn',
      submitLabelSignUp: 'Opprett konto',
      submitLabelSaveChanges: 'Lagre endringer',
      loadingState: 'Lagrer…',
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
    },

    validation: {
      emailRequired: 'E-post er påkrevd',
      emailInvalid: 'E-posten er ugyldig',
      passwordRequired: 'Passord er påkrevd',
      passwordTooShort: 'Passord må være minst 6 tegn',
      firstNameRequired: 'Fornavn er påkrevd',
      lastNameRequired: 'Etternavn er påkrevd',
      shortNameRequired: 'Kortnavn er påkrevd',
      sessionNameRequired: 'Sesjonsnavn er påkrevd',
      sessionDateInvalid: 'Sesjonsdato er ugyldig',
      userNotSelected: 'Sjåfør ikke valgt',
      trackNotSelected: 'Bane ikke valgt',
    },

    success: {
      created: 'Opprettet',
      updated: 'Oppdatert',
      deleted: 'Slettet',
      saved: 'Lagret',
      imported: 'Importert',
      exported: 'Eksportert',
      detailsUpdated: 'Detaljer oppdatert.',
      sessionCreated: 'Sesjon opprettet',
      sessionUpdated: 'Sesjon oppdatert',
      sessionDeleted: 'Sesjon slettet',
      sessionCancelled: 'Sesjon avbrutt',
      signedUpForSession: 'Du har påmeldt deg sesjonen',
      cancelledSessionSignup: 'Du har avmeldt deg sesjonen',
    },

    info: {
      thisIsYourProfile: 'Dette er profilen din',
      noDataAvailable: 'Ingen data tilgjengelig',
      sessionPassed: 'Denne sesjonen har allerede funnet sted',
      cannotSignUp: 'Kan ikke påmeldes en sesjon som allerede har funnet sted',
      cannotCancel:
        'Kan ikke avmelde seg en sesjon som allerede har funnet sted',
    },

    auth: {
      emailNotFound: 'E-post ikke funnet',
      incorrectPassword: 'Feil passord',
      userDoesNotExist: 'Bruker finnes ikke',
      missingEmailOrPassword: 'E-post eller passord mangler',
      roleNotAllowed: 'Rollen din tillater ikke denne handlingen',
      notPermittedToUpdateUser:
        'Du har ikke tillatelse til å oppdatere denne brukeren',
      incorrectCurrentPassword: 'Gjeldende passord er feil',
      noJwtToken: 'Ingen JWT-token gitt',
      secretNotConfigured: "Miljøvariabel 'SECRET' er ikke konfigurert",
    },

    admin: {
      invalidCsvPayload: 'Ugyldig CSV-importforespørsel',
      invalidTable: 'Ugyldig tabell: {{table}}',
      importedSuccessfully:
        'Importerte {{imported}}/{{total}} {{table}} med suksess',
      invalidExportPayload: 'Ugyldig CSV-eksportforespørsel',
      noDataToExport: 'Ingen data å eksportere',
      noObjectsToConvert: 'Ingen objekter å konvertere til CSV',
    },

    track: {
      noLeaderboards: 'Fant ingen ledertavler',
    },

    timeEntry: {
      invalidPostRequest: 'Ugyldig postforespørsel for rundetid',
      roleNotAllowedToPostForOthers:
        'Rollen din tillater ikke å poste rundetider for andre',
    },

    session: {
      invalidCreateRequest: 'Ugyldig opprettelsesforespørsel for sesjon',
      invalidUpdateRequest: 'Ugyldig oppdateringsforespørsel for sesjon',
      invalidDeleteRequest: 'Ugyldig slettingsforespørsel for sesjon',
      invalidCancelRequest: 'Ugyldig avbruddsforespørsel for sesjon',
      invalidSignupRequest: 'Ugyldig påmeldingsforespørsel for sesjon',
      sessionNameCannotBeEmpty: 'Sesjonsnavn kan ikke være tomt',
      sessionNotFound: 'Sesjon ikke funnet.',
      sessionDateInvalid: 'Sesjonsdato er ugyldig.',
      failedToDeleteSession: 'Klarte ikke å slette sesjon.',
      failedToCancelSession: 'Klarte ikke å avbryte sesjon.',
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
