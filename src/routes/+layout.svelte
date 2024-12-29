<script lang="ts">
  import { page } from '$app/stores'
  import '@fontsource/titillium-web'
  import { Plus } from 'lucide-svelte'
  import Flag from 'lucide-svelte/icons/flag'
  import House from 'lucide-svelte/icons/house'
  import { ModeWatcher } from 'mode-watcher'
  import '../app.css'

  let { children } = $props()
</script>

<ModeWatcher />
<div class="flex h-screen flex-col">
  <aside class="pb-safe fixed bottom-0 z-10 w-full border-t bg-background">
    <nav class="flex items-center justify-evenly py-2 text-sm">
      <a
        href="/"
        class="flex flex-col place-items-center {$page.url.pathname === '/'
          ? 'text-foreground'
          : 'text-stone-400'}"
      >
        <House class="size-6" />
        <span>Home</span>
      </a>
      <a
        href="/register"
        class="flex h-10 w-12 flex-col items-center justify-center rounded-lg {$page.url.pathname.startsWith(
          '/register'
        )
          ? 'bg-foreground'
          : 'bg-stone-400'}"
      >
        <Plus class="size-7" color="black" />
        <span class="sr-only">Sessions</span>
      </a>
      <a
        href="/sessions"
        class="flex flex-col place-items-center {$page.url.pathname.startsWith('/sessions')
          ? 'text-foreground'
          : 'text-stone-400'}"
      >
        <Flag class="size-6" />
        <span>Sessions</span>
      </a>
    </nav>
  </aside>
  <div class="m-safe">
    {@render children()}
  </div>
</div>
