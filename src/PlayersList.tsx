import React from "react";
import steamImg from "./images/cropped_steam_image.png";
import { CHEATERS_LANID } from "./CHEATERS_LANID";

// Constants

const createSteamUrl = (steamId: number | string): string => {
  try {
    const STEAM_ID_OFFSET = 76561197960265728n;
    return `https://steamcommunity.com/profiles/${(STEAM_ID_OFFSET + BigInt(String(steamId))).toString()}`;
  } catch {
    return "";
  }
};

// Small components
const ColorChip: React.FC<{ color: number }> = ({ color }) => {
  return <span className={`color-chip color-${color}`} />;
};

const SteamProfileLink: React.FC<{
  steamId?: number | string | undefined;
  name?: string | undefined;
  className?: string;
}> = ({ steamId, name, className = "" }) => {
  if (!steamId || String(steamId) === "0") return null;
  const url = createSteamUrl(steamId);

  if (url.length > 0)
    return (
      <span className="steam-link-wrapper">
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
        <div className="steam-tooltip" role="tooltip">
          <div className="steam-tooltip-arrow" />
          <div className="steam-tooltip-content">{url}</div>
        </div>
      </span>
    );

  return null;
};

const LanidBadge: React.FC<{
  lanid: number;
  playerName: string;
  lanidNames: Record<string | number, string[]>;
}> = ({ lanid, playerName, lanidNames }) => {
  const namesArr = lanidNames[lanid] ?? [];
  const hasMultiple = namesArr.length > 1;
  const otherNames = namesArr.filter((n) => n !== playerName);

  return (
    <span className="lanid-badge-wrapper">
      <span
        className={`lanid-badge${hasMultiple ? " lanid-badge--multi" : ""}`}
      >
        {lanid}
      </span>
      {CHEATERS_LANID.includes(lanid) && (
        <span className="cheater-badge" title="Reported cheater">
          🚨 cheater
        </span>
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

const ExtraSteamLinks: React.FC<{
  links: Array<{ id: string | number; name?: string }>;
}> = ({ links }) => {
  const renderedLinks = links.map((e, idx) => (
    <SteamProfileLink
      key={`ex-${idx}`}
      steamId={e.id}
      name={e.name}
      className="steam-link--extra"
    />
  ));

  return renderedLinks.length ? (
    <span className="steam-extras" title="Extra Steam links">
      <span className="steam-extras__pill">extra</span>
      {renderedLinks}
    </span>
  ) : null;
};

const PlayerItem: React.FC<{
  player: PlayersListProps["validPlayers"][0];
  lanidNames: Record<string | number, string[]>;
}> = ({ player, lanidNames }) => {
  return (
    <li key={`${player.id}-${player.lanid}-${player.color}`}>
      {player.name} (id: {player.id})
      <SteamProfileLink steamId={player.steamId} name={player.steamName} />{" "}
      lanid{" "}
      <LanidBadge
        lanid={player.lanid}
        playerName={player.name}
        lanidNames={lanidNames}
      />
      <ExtraSteamLinks links={player.extraSteamLinks} /> team {player.team}{" "}
      color {player.color}
      <ColorChip color={player.color} />
    </li>
  );
};

// Main component
export type PlayersListProps = {
  validPlayers: {
    original: any;
    name: string;
    id: number;
    lanid: number;
    color: number;
    team: number;
    steamId?: string | number | undefined;
    steamName?: string;
    extraSteamLinks: Array<{ id: string | number; name?: string }>;
  }[];
  lanidNames: Record<string | number, string[]>;
};

export const PlayersList: React.FC<PlayersListProps> = ({
  validPlayers,
  lanidNames,
}) => {
  if (!validPlayers.length) return <>—</>;

  return (
    <ul className="players-list">
      {validPlayers.map((player) => (
        <PlayerItem
          key={`${player.id}-${player.lanid}-${player.color}`}
          player={player}
          lanidNames={lanidNames}
        />
      ))}
    </ul>
  );
};
