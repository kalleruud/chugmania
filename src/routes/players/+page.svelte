<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const { users, loggedInUser } = data
</script>

<main class="m-4 flex flex-col">
  <h1>Spillere</h1>
  {#each users as user}
    <p>{user.name}</p>
  {/each}
</main>
