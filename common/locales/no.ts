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
      permissionDenied: 'Du har ikke tillatelse til denne handlingen',
      notFound404: 'Ikke funnet',
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
      missingEmailOrPassword: 'E-post eller passord mangler',
      sessionNameRequired: 'Sesjonsnavn er påkrevd',
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
      importedSuccessfully:
        'Importerte {{imported}}/{{total}} {{table}} med suksess',
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
      sessionNotFound: 'Sesjon ikke funnet.',
      failedToProcess: 'Klarte ikke å {{action}} sesjon.',
    },
  },
} as const
