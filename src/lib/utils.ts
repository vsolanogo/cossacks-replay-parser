import { NATION_NAMES } from './constants';

export const getNationName = (cid: number | undefined): string => {
  if (cid === undefined || Number.isNaN(cid)) return "";
  if (cid === -2) return "SPECTATOR";
  if (cid === 24) return "Random";
  if (cid >= 0 && cid < NATION_NAMES.length) return NATION_NAMES[cid];
  return "";
};

export const createSteamUrl = (steamId: number | string): string => {
  try {
    const STEAM_ID_OFFSET = 76561197960265728n;
    return `https://steamcommunity.com/profiles/${(STEAM_ID_OFFSET + BigInt(String(steamId))).toString()}`;
  } catch {
    return "";
  }
};

export const filterValidPlayers = (players: any[]): any[] => {
  return players.filter((p) => {
    const bexists = p?.bexists === true;
    const lanidZero = p.lanid === 0;
    const nameStr = p?.name ? String(p.name) : "";
    const isPlaceholderName = nameStr.trim().toLowerCase() === "name";
    const isEmptySlot = lanidZero && isPlaceholderName;
    return bexists && !isEmptySlot;
  });
};

export const normalizeName = (s: string | undefined) =>
  (s ?? "").replace(/%color\([^\)]*\)%/gi, "").replace(/\s+/g, " ").trim().toLowerCase();