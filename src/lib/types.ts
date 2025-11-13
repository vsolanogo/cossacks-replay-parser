export type ParseResultStatus = "completed" | "error";

export interface ParseResult {
  fileName: string;
  status: ParseResultStatus;
  data?: GameInfo | null;
  error?: string;
}

export interface Player {
  id: number;
  cid: number;
  csid: string;
  name: string;
  team: number;
  color: number;
  lanid: number;
  startx: number;
  starty: number;
  aidifficulty: number;
  bexists: boolean;
  bai: boolean;
  bhuman: boolean;
  bclosed: boolean;
  bready: boolean;
  bloaded: boolean;
  bleave: boolean;
  sic?: number;
  si1?: number;
  si2?: number;
  si3?: number;
  snc?: string;
  sn1?: string;
  sn2?: string;
  sn3?: string;
}

export interface GameInfo {
  gameId: string;
  gMapName: string;
  mapSize: number;
  terrainType: number;
  reliefType: number;
  players: Player[];
}

export type ResultRow = ParseResult & { key: string; uploadedAt: number };