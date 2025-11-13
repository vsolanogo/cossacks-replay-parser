import React from "react";
import type { GameInfo } from "./fileParser.worker";
import steamImg from "./images/cropped_steam_image.png";
import { CHEATERS_LANID } from "./CHEATERS_LANID";

// Constants
const NATION_NAMES: string[] = [
  "Random",
  "Austria",
  "France",
  "England",
  "Spain",
  "Russia",
  "Ukraine",
  "Poland",
  "Sweden",
  "Prussia",
  "Venice",
  "Turkey",
  "Algeria",
  "Netherlands",
  "Denmark",
  "Portugal",
  "Piedmont",
  "Saxony",
  "Bavaria",
  "Hungary",
  "Switzerland",
  "Scotland",
  "SPECTATOR",
];

const COLORS_RGB: string[] = [
  "252, 3, 3",
  "11, 3, 252",
  "3, 244, 252",
  "175, 0, 250",
  "245, 113, 12",
  "47, 217, 4",
  "252, 250, 250",
  "247, 65, 250",
  "238, 255, 0",
  "56, 35, 176",
  "145, 255, 149",
  "99, 53, 7",
];

// Helper functions
const getNationName = (cid: number | undefined): string => {
  if (cid === undefined || Number.isNaN(cid)) return "";
  if (cid === -2) return "SPECTATOR";
  if (cid === 24) return "Random";
  if (cid >= 0 && cid < NATION_NAMES.length) return NATION_NAMES[cid];
  return "";
};

const createSteamUrl = (steamId: number | string): string => {
  try {
    const STEAM_ID_OFFSET = 76561197960265728n;
    return `https://steamcommunity.com/profiles/${(STEAM_ID_OFFSET + BigInt(String(steamId))).toString()}`;
  } catch {
    return "";
  }
};

const filterValidPlayers = (players: any[]): any[] => {
  return players.filter((p) => {
    const bexists = (p as any)?.bexists === true;
    const lanidZero = p.lanid === 0;
    const nameStr = (p as any)?.name ? String((p as any).name) : "";
    const isPlaceholderName = nameStr.trim().toLowerCase() === "name";
    // Hide obvious empty slots like: name (id: N) lanid 0 team 0 color X
    const isEmptySlot = lanidZero && isPlaceholderName;
    return bexists && !isEmptySlot;
  });
};

// Custom hook
const useFilteredPlayers = (data?: GameInfo | null) => {
  return React.useMemo(() => {
    if (!data?.players) return [];
    return filterValidPlayers(data.players);
  }, [data?.players]);
};

// Small components
const ColorChip: React.FC<{ color: number }> = ({ color }) => {
  return (
    <span
      aria-label="color"
      title={`rgb(${COLORS_RGB[color] ?? ""})`}
      className={`color-chip color-${color}`}
    />
  );
};

const SteamProfileLink: React.FC<{ 
  steamId?: number | string, 
  name?: string, 
  className?: string 
}> = ({ steamId, name, className = "" }) => {
  if (!steamId || String(steamId) === "0") return null;
  
  try {
    const url = createSteamUrl(steamId);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={name ? `Open Steam profile: ${name}` : "Open Steam profile"}
        className={`steam-link ${className}`}
      >
        <img src={steamImg} alt="Steam" className="steam-icon" />
        {name ? <span>{name}</span> : null}
      </a>
    );
  } catch {
    return null;
  }
};

const LanidBadge: React.FC<{ 
  lanid: number, 
  playerName: string, 
  lanidNames: Record<string | number, string[]> 
}> = ({ lanid, playerName, lanidNames }) => {
  const namesArr = lanidNames[lanid] ?? [];
  const hasMultiple = namesArr.length > 1;
  const otherNames = namesArr.filter((n) => n !== playerName);
  
  return (
    <span className="lanid-badge-wrapper">
      <span className={`lanid-badge${hasMultiple ? " lanid-badge--multi" : ""}`}>{lanid}</span>
      {CHEATERS_LANID.includes(lanid) && (
        <span className="cheater-badge" title="Reported cheater">🚨 cheater</span>
      )}
      {hasMultiple && (
        <span className="lanid-tooltip" role="tooltip">
          <div className="lanid-tooltip-title">Other names</div>
          <ul className="lanid-tooltip-list">
            {otherNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
};

const ExtraSteamLinks: React.FC<{ player: any }> = ({ player }) => {
  const extras: Array<{ id?: number | string; name?: string }> = [
    { id: (player as any)?.si1, name: (player as any)?.sn1 },
    { id: (player as any)?.si2, name: (player as any)?.sn2 },
    { id: (player as any)?.si3, name: (player as any)?.sn3 },
  ];
  
  const primary = (player as any)?.sic as number | string | undefined;
  const primaryStr = primary != null ? String(primary) : "0";
  
  const links = extras
    .filter((e) => e.id != null && String(e.id) !== "0" && String(e.id) !== primaryStr)
    .map((e, idx) => (
      <SteamProfileLink
        key={`ex-${idx}`}
        steamId={e.id}
        name={e.name}
        className="steam-link--extra"
      />
    ))
    .filter(Boolean);
    
  return links.length ? (
    <span className="steam-extras" title="Extra Steam links">
      <span className="steam-extras__pill">extra</span>
      {links}
    </span>
  ) : null;
};

const PlayerItem: React.FC<{ 
  player: any, 
  lanidNames: Record<string | number, string[]> 
}> = ({ player, lanidNames }) => {
  return (
    <li key={`${player.id}-${player.lanid}-${player.color}`}>
      {player.name} (id: {player.id})
      <SteamProfileLink 
        steamId={(player as any)?.sic} 
        name={(player as any)?.snc} 
      />
      {" "}lanid {" "}
      <LanidBadge 
        lanid={player.lanid} 
        playerName={player.name} 
        lanidNames={lanidNames} 
      />
      <ExtraSteamLinks player={player} />
      {" "}team {player.team} color {player.color}
      <ColorChip color={player.color} />
    </li>
  );
};

// Main component
export type PlayersListProps = {
  data?: GameInfo | null;
  lanidNames: Record<string | number, string[]>;
};

export const PlayersList: React.FC<PlayersListProps> = ({ data, lanidNames }) => {
  const players = useFilteredPlayers(data);
  
  if (!players.length) return <>—</>;

  return (
    <ul className="players-list">
      {players.map((player) => (
        <PlayerItem 
          key={`${player.id}-${player.lanid}-${player.color}`} 
          player={player} 
          lanidNames={lanidNames} 
        />
      ))}
    </ul>
  );
};