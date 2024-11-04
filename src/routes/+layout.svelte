<script lang="ts">
  import House from 'lucide-svelte/icons/house'
  import Package2 from 'lucide-svelte/icons/package-2'
  import ShoppingCart from 'lucide-svelte/icons/shopping-cart'

  import { ModeToggle } from '@/components/ui/mode-toggle'
  import '@fontsource/titillium-web'
  import { ModeWatcher } from 'mode-watcher'
  import '../app.css'

  let { children } = $props()
</script>

<ModeWatcher />
<div class="flex min-h-screen w-full flex-col bg-muted/40">
  <aside class="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
    <nav class="flex flex-col items-center gap-4 px-2 sm:py-5">
      <a
        href="##"
        class="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
      >
        <Package2 class="h-4 w-4 transition-all group-hover:scale-110" />
        <span class="sr-only">Acme Inc</span>
      </a>

      <a
        href="##"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
      >
        <House class="h-5 w-5" />
        <span class="sr-only">Dashboard</span>
      </a>
      <a
        href="##"
        class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
      >
        <ShoppingCart class="h-5 w-5" />
        <span class="sr-only">Orders</span>
      </a>
    </nav>
    <nav class="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
      <a
        href="##"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
      >
        <ModeToggle />
        <span class="sr-only">Settings</span>
      </a>
    </nav>
  </aside>
  {@render children()}
</div>
