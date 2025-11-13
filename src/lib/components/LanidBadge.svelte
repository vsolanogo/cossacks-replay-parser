<script lang="ts">
  import { CHEATERS_LANID } from '../constants';

  export let lanid: number;
  export let playerName: string;
  export let lanidNames: Record<string | number, string[]>;

  $: namesArr = lanidNames[lanid] ?? [];
  $: hasMultiple = namesArr.length > 1;
  $: otherNames = namesArr.filter((n) => n !== playerName);
  $: isCheater = CHEATERS_LANID.includes(lanid);
</script>

<span class="lanid-badge-wrapper">
  <span class="lanid-badge{hasMultiple ? ' lanid-badge--multi' : ''}">{lanid}</span>
  {#if isCheater}
    <span class="cheater-badge" title="Reported cheater">🚨 cheater</span>
  {/if}
  {#if hasMultiple}
    <span class="lanid-tooltip" role="tooltip">
      <div class="lanid-tooltip-title">Other names</div>
      <ul class="lanid-tooltip-list">
        {#each otherNames as name}
          <li>{name}</li>
        {/each}
      </ul>
    </span>
  {/if}
</span>