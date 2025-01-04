<script lang="ts">
  import Login from '@/components/login/login.svelte'
  import type { FormMode } from '@/components/types.server'

  let mode = $state<FormMode>('login')

  const details: Record<FormMode, { title: string; description: string; button: string }> = {
    register: {
      title: 'Registrer deg',
      description: 'Dytt inn infoen din, så er du klar til å chugge på null tid',
      button: 'Kroppen min er klar',
    },
    login: {
      title: 'Nættopp',
      description: 'Skriv inn mailen din for å logge inn',
      button: 'Trykk her hvis du har liten tiss',
    },
  }
</script>

<svelte:head>
  <title>{details[mode].title}</title>
</svelte:head>

<div class="flex h-dvh w-full touch-none flex-col items-center">
  <div class="m-8 flex w-5/6 max-w-lg rounded-lg bg-secondary p-1">
    <button
      type="button"
      class="flex-1 rounded-sm py-1 transition-colors"
      class:bg-background={mode === 'login'}
      class:text-muted-foreground={mode !== 'login'}
      onclick={() => (mode = 'login')}
    >
      Logg inn
    </button>
    <button
      type="button"
      class="flex-1 rounded-sm py-1 transition-colors"
      class:bg-background={mode === 'register'}
      class:text-muted-foreground={mode !== 'register'}
      onclick={() => (mode = 'register')}
    >
      Registrer
    </button>
  </div>
  <div class="w-full max-w-2xl px-4">
    <Login {...details[mode]} {mode} />
  </div>
</div>
