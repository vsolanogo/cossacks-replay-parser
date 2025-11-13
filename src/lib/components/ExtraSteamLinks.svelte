<script lang="ts">
  import SteamProfileLink from './SteamProfileLink.svelte';

  export let player: any;

  $: extras = [
    { id: player?.si1, name: player?.sn1 },
    { id: player?.si2, name: player?.sn2 },
    { id: player?.si3, name: player?.sn3 },
  ];

  $: primary = player?.sic;
  $: primaryStr = primary != null ? String(primary) : "0";

  $: links = extras
    .filter((e) => e.id != null && String(e.id) !== "0" && String(e.id) !== primaryStr)
    .map((e, idx) => ({
      id: e.id,
      name: e.name,
      key: `ex-${idx}`
    }))
    .filter(Boolean);
</script>

{#if links.length}
  <span class="steam-extras" title="Extra Steam links">
    <span class="steam-extras__pill">extra</span>
    {#each links as link}
      <SteamProfileLink steamId={link.id} name={link.name} className="steam-link--extra" />
    {/each}
  </span>
{/if}