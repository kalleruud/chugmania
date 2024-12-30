export type FailDetails = { status: number; message: string }
export function isFailed(details: unknown): details is FailDetails {
  if (!details) return false
  if (!(details instanceof Object)) return false
  return 'status' in details && 'message' in details
}

export function toRelativeLocaleDateString(then: Date, locales: Intl.LocalesArgument = 'nb') {
  const today = new Date()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  if (then.toDateString() === today.toDateString()) return 'I dag'
  if (then.toDateString() === yesterday.toDateString()) return 'I går'
  if (then.toDateString() === tomorrow.toDateString()) return 'I morgen'

  if (then >= lastWeek && then <= today)
    return 'Forrige ' + then.toLocaleDateString(locales, { weekday: 'long' })

  if (then >= today && then <= nextWeek)
    return 'Neste ' + then.toLocaleDateString(locales, { weekday: 'long' })

  return then.toLocaleDateString(locales, { month: 'long', day: 'numeric', year: 'numeric' })
}
