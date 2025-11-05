export type Localization = typeof no
export type Locale = 'no'

const no = {
  tracks: {
    title: 'Baner',
    description: 'Oversikt over banetider per bane.',
  },
}

const loc: Record<Locale, Localization> = {
  no,
}

export default loc
