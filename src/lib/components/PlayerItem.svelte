<script lang="ts">
  import ColorChip from './ColorChip.svelte';
  import SteamProfileLink from './SteamProfileLink.svelte';
  import LanidBadge from './LanidBadge.svelte';
  import ExtraSteamLinks from './ExtraSteamLinks.svelte';

  export let player: any;
  export let lanidNames: Record<string | number, string[]>;
</script>

<li>
  {player.name} (id: {player.id})
  <SteamProfileLink steamId={player?.sic} name={player?.snc} />
  lanid 
  <LanidBadge 
    lanid={player.lanid} 
    playerName={player.name} 
    lanidNames={lanidNames} 
  />
  <ExtraSteamLinks player={player} />
  team {player.team} color {player.color}
  <ColorChip color={player.color} />
</li>