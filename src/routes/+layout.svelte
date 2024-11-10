<script lang="ts">
  import { page } from '$app/stores'
  import '@fontsource/titillium-web'
  import Flag from 'lucide-svelte/icons/flag'
  import House from 'lucide-svelte/icons/house'
  import { ModeWatcher } from 'mode-watcher'
  import '../app.css'

  let { children } = $props()

  const navButtonClasses =
    'flex flex-col items-center justify-center rounded-lg transition-colors sm:hover:text-secondary-foreground'
</script>

<ModeWatcher />
<div class="w-dvh flex flex-col">
  <aside
    class="fixed left-0 z-10 flex bg-background max-sm:bottom-0 max-sm:h-16 max-sm:w-full max-sm:flex-row max-sm:border-t sm:inset-y-0 sm:w-20 sm:flex-col sm:border-r"
  >
    <nav class="flex gap-4 max-sm:w-full max-sm:justify-evenly sm:flex-col sm:py-6">
      <a
        href="/"
        class="{navButtonClasses} {$page.url.pathname === '/'
          ? 'text-foreground'
          : 'text-stone-400'}"
      >
        <House class="size-5" />
        <span>Home</span>
      </a>
      <a
        href="/sessions"
        class="{navButtonClasses} {$page.url.pathname.startsWith('/sessions')
          ? 'text-foreground'
          : 'text-stone-400'}"
      >
        <Flag class="size-5" />
        <span>Sessions</span>
      </a>
    </nav>
  </aside>
  <div class="max-sm:pb-16 sm:pl-20">
    {@render children()}
  </div>
</div>
