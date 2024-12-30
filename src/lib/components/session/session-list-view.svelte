<script lang="ts">
  import type { Session } from '../types.server'

  type Props = {
    class: string
    session: Session
  }

  let { class: topClass, session }: Props = $props()

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
    {session.relativeDate}
  </p>
</div>
