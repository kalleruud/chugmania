<script lang="ts">
  import { page } from '$app/stores'
</script>

<div class="flex h-screen flex-col items-center justify-center">
  <h1>{$page.status}</h1>
</div>
