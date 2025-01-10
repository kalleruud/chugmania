<script lang="ts">
  import type { PublicUser } from '../types.server'

  type Props = {
    group: any
    user: PublicUser
  }
  let { group, user }: Props = $props()
</script>

<div>
  <div class="mb-2 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <p class="text-muted-foreground">Grp.</p>
      <h3>{group.name}</h3>
    </div>
    <p class="mx-2 text-muted-foreground">PTS</p>
  </div>
  <div class="grid">
    {#each group.users as user, i}
      <div class="flex items-center justify-between border-t py-2">
        <div class="flex items-center gap-2">
          <span class="font-f1 italic text-muted-foreground">{i + 1}</span>
          <span class="font-f1 italic">{user.shortName}</span>
          {#if i < 2}
            <div class=" size-2 rounded-full bg-green-700"></div>
          {/if}
        </div>
        <div>
          {user.points}
          <span class="text-sm text-muted-foreground"> / {group.users.length - 1}</span>
        </div>
      </div>
    {/each}
  </div>
</div>
