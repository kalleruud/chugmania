<script lang="ts">
  import * as Card from '$lib/components/ui/card'
  import type { Track } from './track-grid.server'

  interface Props {
    tracks: Track[]
    onClick: (track: Track) => void
  }

  let { tracks, onClick }: Props = $props()

  const columnClasses = 'inline-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4'

  const trackStyles: Record<Track['level'], string> = {
    custom: 'dark:bg-orange-900 bg-orange-400',
    blue: 'dark:bg-blue-900 bg-blue-400',
    green: 'dark:bg-green-900 bg-green-400',
    red: 'dark:bg-red-900 bg-red-400 dark:hover:bg-red-800 hover:bg-red-500',
    white: 'dark:bg-stone-100 text-stone-900',
    black: 'dark:bg-primary-background bg-stone-900 text-stone-100',
  }

  function chunkList(inputList: Track[], chunkSize: number = 10): Track[][] {
    const chunkedList: Track[][] = []

    for (let i = 0; i < inputList.length; i += chunkSize) {
      chunkedList.push(inputList.slice(i, i + chunkSize))
    }

    return chunkedList
  }
</script>

<div class="flex justify-center">
  <div class={columnClasses}>
    {#each chunkList(tracks) as trackChunk}
      <div class="inline-grid grid-cols-5 gap-1 p-1">
        {#each trackChunk as track}
          <button onclick={() => onClick(track)}>
            <Card.Root
              class="
                aspect-square
                max-w-16
                p-1
                content-center
                justify-items-center
                overflow-clip
                transition-colors
                {trackStyles[track.level]}
              "
            >
              <h3 class="font-f1 text-xl font-black tracking-wider">{track.name}</h3>
            </Card.Root>
          </button>
        {/each}
      </div>
    {/each}
  </div>
</div>
