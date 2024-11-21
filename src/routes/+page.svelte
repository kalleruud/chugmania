<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const user = data.user
</script>

<h1>Hei, {user?.name}</h1>
