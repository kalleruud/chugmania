<script lang="ts">
  import { page } from '$app/stores'
  import * as Card from '$lib/components/ui/card/index.js'
</script>

<div class="flex h-screen flex-col items-center justify-center">
  <Card.Root class="w-full max-w-sm">
    <Card.Content>
      <h1>{$page.status}</h1>
      <Card.Description>{$page.error?.message}</Card.Description>
    </Card.Content>
  </Card.Root>
</div>
