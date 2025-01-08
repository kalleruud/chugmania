<script lang="ts">
  import { page } from '$app/stores'
  import '@fontsource/titillium-web'
  import { Beer, IdCard, Map, Plus } from 'lucide-svelte'
  import Flag from 'lucide-svelte/icons/flag'
  import { ModeWatcher } from 'mode-watcher'
  import type { Snippet } from 'svelte'
  import '../app.css'

  let { children }: { children: Snippet } = $props()
</script>

<svelte:head>
  <title>Chugmania</title>
</svelte:head>

<ModeWatcher />
<div class="flex h-screen flex-col">
  <aside class="fixed bottom-0 z-10 w-full border-t bg-background/75 backdrop-blur pb-safe">
    <nav class="flex items-center justify-around py-2 text-sm">
      <a
        href="/"
        class="flex w-12 flex-col place-items-center {$page.url.pathname === '/'
          ? 'text-foreground'
          : 'text-stone-400'}"
      >
        <Beer class="size-6" />
        <span>I dag</span>
      </a>
      <a
        href="/tracks"
        class="flex w-12 flex-col place-items-center {$page.url.pathname === '/tracks'
          ? 'text-foreground'
          : 'text-stone-400'}"
      >
        <Map class="size-6" />
        <span>Baner</span>
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
        <span class="sr-only">Registrer tid</span>
      </a>
      <a
        href="/sessions"
        class="flex w-12 flex-col place-items-center {$page.url.pathname.startsWith('/sessions')
          ? 'text-foreground'
          : 'text-stone-400'}"
      >
        <Flag class="size-6" />
        <span>Sessions</span>
      </a>
      <a
        href="/users"
        class="flex w-12 flex-col place-items-center {$page.url.pathname.startsWith('/users')
          ? 'text-foreground'
          : 'text-stone-400'}"
      >
        <IdCard class="size-6" />
        <span>Spillere</span>
      </a>
    </nav>
  </aside>
  <div class="m-safe">
    {@render children()}
  </div>
</div>
