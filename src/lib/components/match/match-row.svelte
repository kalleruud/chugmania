<script lang="ts">
  import { enhance } from '$app/forms'
  import type { Match, PublicUser } from '../types.server'
  import Badge from '../ui/badge/badge.svelte'

  type Props = {
    match: Match
    user: PublicUser
  }
  const isWinner = (user: PublicUser) => match.winner?.id === user.id
  let { match, user }: Props = $props()
</script>

<div class="grid gap-2 p-2">
  <div class="flex items-center justify-center gap-4 py-2 font-f1 font-bold">
    <form use:enhance method="post" action="?/setWinner">
      <input type="hidden" name="match" value={match.id} />
      <input type="hidden" name="currentWinner" value={match.winner?.id} />
      <button
        class="h-fit rounded-xl border px-4 py-2 text-2xl italic transition-colors
        {match.user1.id === user.id ? 'text-primary' : 'text-muted-foreground'}
        {isWinner(match.user2) && 'border-red-900 bg-red-950 text-black'}
        {isWinner(match.user1) && 'border-green-300 bg-green-900 text-green-300'}"
        type="submit"
        name="winner"
        value={match.user1.id}
      >
        {match.user1.shortName}
      </button>
    </form>

    <div class="grid place-items-center gap-2">
      <Badge class="w-fit" variant="outline">{match.track.name}</Badge>
      <Badge class="w-fit {match.track.level.class}">{match.track.level.id}</Badge>
      <Badge class="w-fit {match.track.type.class}">{match.track.type.id}</Badge>
    </div>

    <form use:enhance method="post" action="?/setWinner">
      <input type="hidden" name="match" value={match.id} />
      <input type="hidden" name="currentWinner" value={match.winner?.id} />
      <button
        class="h-fit rounded-xl border px-4 py-2 text-2xl italic transition-colors
        {match.user2.id === user.id ? 'text-primary' : 'text-muted-foreground'}
        {isWinner(match.user1) && 'border-red-900 bg-red-950 text-black'}
        {isWinner(match.user2) && 'border-green-300 bg-green-900 text-green-300'}"
        type="submit"
        name="winner"
        value={match.user2.id}
      >
        {match.user2.shortName}
      </button>
    </form>
  </div>
</div>
