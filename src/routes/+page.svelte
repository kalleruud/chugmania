<script lang="ts">
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const user = data.user
</script>

<HeaderBar class="px-4 py-2">
  <h1>Hei, {user?.name}</h1>
</HeaderBar>
