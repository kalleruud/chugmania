<script lang="ts">
  import type { PublicUser } from '../types.server'

  type Props = {
    class?: string
    user: PublicUser
  }

  let { class: className, user }: Props = $props()
</script>

<div class={className}>
  <div class="grid grid-cols-3 gap-4">
    <p>{user.name}</p>
    <p>{user.shortName}</p>
  </div>
</div>
