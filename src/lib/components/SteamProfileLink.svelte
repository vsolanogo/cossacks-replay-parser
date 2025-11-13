<script lang="ts">
  import { createSteamUrl } from '../utils';
  import steamImg from '$lib/assets/cropped_steam_image.png'; 

  export let steamId: number | string;
  export let name: string;
  export let className = '';

  $: url = steamId && String(steamId) !== "0" ? createSteamUrl(steamId) : null;
</script>

{#if url}
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    title={name ? `Open Steam profile: ${name}` : "Open Steam profile"}
    class="steam-link {className}"
  >
    <img src={steamImg} alt="Steam" class="steam-icon" />
    {#if name}<span>{name}</span>{/if}
  </a>
{/if}