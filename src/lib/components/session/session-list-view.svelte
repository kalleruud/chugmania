<script lang="ts">
  import type { Session } from '../lookup/lookup.server'

  type Props = {
    class: string
    session: Session
  }

  let { class: topClass, session }: Props = $props()

  function toRelativeLocaleDateString(then: Date, locales: Intl.LocalesArgument = 'nb') {
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

  function toTitleCase(str: string) {
    return str.replace(
      /\w\S*/g, // Matches words starting with a letter
      txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    )
  }
</script>

<div class="flex items-center justify-between {topClass}">
  <h3>
    {session.description ?? toTitleCase(session.type)}
  </h3>
  <p class="text-sm text-muted-foreground">
    {toRelativeLocaleDateString(session.date)}
  </p>
</div>
