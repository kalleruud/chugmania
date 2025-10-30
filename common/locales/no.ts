export const noLocale = {
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
      missingEmailOrPassword: 'E-post eller passord mangler',
      sessionNameCannotBeEmpty: 'Sesjonsnavn kan ikke være tomt',
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
      sessionNotFound: 'Sesjon ikke funnet.',
      failedToDeleteSession: 'Klarte ikke å slette sesjon.',
      failedToCancelSession: 'Klarte ikke å avbryte sesjon.',
    },
  },
} as const
