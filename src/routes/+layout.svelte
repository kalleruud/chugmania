<script lang="ts">
  import { page } from '$app/stores'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import '@fontsource/titillium-web'
  import Flag from 'lucide-svelte/icons/flag'
  import House from 'lucide-svelte/icons/house'
  import Moon from 'lucide-svelte/icons/moon'
  import Sun from 'lucide-svelte/icons/sun'
  import { ModeWatcher, resetMode, setMode } from 'mode-watcher'
  import '../app.css'

  let { children } = $props()
  const buttonClass =
    'flex h-9 w-9 items-center justify-center rounded-lg text-accent-foreground transition-colors hover:text-foreground md:h-8 md:w-8'
</script>

<ModeWatcher />
<div class="flex w-screen flex-col">
  <aside class="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
    <nav class="flex flex-col items-center gap-4 px-2 sm:py-5">
      <a href="/" class={buttonClass} class:bg-accent={$page.url.pathname === '/'}>
        <House class="size-5" />
        <span class="sr-only">Home</span>
      </a>
      <a
        href="/sessions"
        class={buttonClass}
        class:bg-accent={$page.url.pathname.includes('/sessions')}
      >
        <Flag class="size-5" />
        <span class="sr-only">Sessions</span>
      </a>
    </nav>
    <nav class="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
      <div class={buttonClass}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild let:builder>
            <Button builders={[builder]} variant="ghost" size="icon">
              <Sun class="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon
                class="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
              />
              <span class="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item on:click={() => setMode('light')}>Light</DropdownMenu.Item>
            <DropdownMenu.Item on:click={() => setMode('dark')}>Dark</DropdownMenu.Item>
            <DropdownMenu.Item on:click={() => resetMode()}>System</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <span class="sr-only">Display mode</span>
      </div>
    </nav>
  </aside>
  <div class="sm:pl-14">
    {@render children()}
  </div>
</div>
