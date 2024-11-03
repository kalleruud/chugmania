<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const user = data.user
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
{#if user}
  <p>Logged in as {user.name}</p>
{:else}
  <a href="/login">Logg inn</a>
{/if}
