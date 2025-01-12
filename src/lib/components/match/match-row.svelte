<script lang="ts">
  import { enhance } from '$app/forms'
  import type { BracketRound, PublicUser } from '../types.server'
  import Badge from '../ui/badge/badge.svelte'

  type Props = {
    match: BracketRound
    user: PublicUser
  }
  const isWinner = (user: PublicUser) => match.winner?.id === user.id
  let { match, user }: Props = $props()
</script>

<div class="grid gap-2 p-2">
  <div class="flex items-center justify-center gap-4 py-2 font-f1 font-bold">
    {@render player(match.user1, match.user1?.id === user.id)}

    <div class="grid place-items-center gap-2">
      <Badge class="w-fit" variant="outline">{match.track?.name}</Badge>
      <Badge class="w-fit {match.track?.level.class}">{match.track?.level.id}</Badge>
      <Badge class="w-fit {match.track?.type.class}">{match.track?.type.id}</Badge>
    </div>

    {@render player(match.user2, match.user2?.id === user.id)}
  </div>
</div>

{#snippet player(user: PublicUser | undefined, isMe: boolean)}
  <form use:enhance method="post" action="?/setWinner">
    <input type="hidden" name="match" value={match.id} />
    <input type="hidden" name="currentWinner" value={match.winner?.id} />
    <button
      class="h-fit rounded-xl border px-4 py-2 text-lg italic transition-colors
      {match.winner && !isWinner(user) && 'border-red-500/50 bg-red-500/20 text-red-500'}
      {isWinner(user) && 'border-green-500/50 bg-green-500/20 text-green-500'}
      {isMe && 'border-primary'}
      "
      type="submit"
      name="winner"
      value={user?.id}
    >
      {user?.shortName}
    </button>
  </form>
{/snippet}
