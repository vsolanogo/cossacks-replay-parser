<script lang="ts">
  import { filterValidPlayers } from '../utils';
  import PlayerItem from './PlayerItem.svelte';
  import type { GameInfo } from '../types';

  export let data: GameInfo | null | undefined;
  export let lanidNames: Record<string | number, string[]>;

  $: players = data?.players ? filterValidPlayers(data.players) : [];
</script>

{#if players.length}
  <ul class="players-list">
    {#each players as player}
      <PlayerItem 
        player={player} 
        lanidNames={lanidNames} 
      />
    {/each}
  </ul>
{:else}
  —
{/if}