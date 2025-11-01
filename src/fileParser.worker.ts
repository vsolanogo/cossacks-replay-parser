/// <reference lib="webworker" />
// Web Worker for parsing text files
declare const self: DedicatedWorkerGlobalScope;

type ParseResultStatus = "completed" | "error";

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
}

export interface GameInfo {
  gameId: string;
  gMapName: string;
  mapSize: number;
  terrainType: number;
  reliefType: number;
  players: Player[];
}

const mapRegex =
  /(?:^|\s)UID(\d+).*?gMap name (\S+).*?mapsize (\d+).*?terraintype (\d+).*?relieftype (\d+)/s;

var playerRegex =
  /\* id (\d+) cid (\d+) csid name (\S+) team (\d+) color (\d+) lanid (\d+) startx (\d+) starty (\d+) aidifficulty (\d+) bexists (true|false) bai (true|false) bhuman (true|false) bclosed (true|false) bready (true|false) bloaded (true|false) bleave (true|false)/g;

self.onmessage = (e: MessageEvent<File>) => {
  var file = e.data;

  var reader = new FileReader();

  reader.onload = (event: ProgressEvent<FileReader>) => {
    try {
      var text: string | null = (event.target?.result ?? "") as string;
      text = text.replace(/[^ -~]+/g, " ");

      var gameMatch = mapRegex.exec(text);

      if (!gameMatch) {
        throw new Error("Game info not found in file");
      }

      var gameInfo: GameInfo = {
        gameId: gameMatch[1],
        gMapName: gameMatch[2],
        mapSize: parseInt(gameMatch[3], 10),
        terrainType: parseInt(gameMatch[4], 10),
        reliefType: parseInt(gameMatch[5], 10),
        players: []
      };

      // Process players one by one instead of storing all matches
      var match;
      while ((match = playerRegex.exec(text)) !== null) {
        gameInfo.players.push({
          id: parseInt(match[1]),
          cid: parseInt(match[2]),
          csid: match[3],
          name: match[3],
          team: parseInt(match[4]),
          color: parseInt(match[5]),
          lanid: parseInt(match[6]),
          startx: parseInt(match[7]),
          starty: parseInt(match[8]),
          aidifficulty: parseInt(match[9]),
          bexists: match[10] === "true",
          bai: match[11] === "true",
          bhuman: match[12] === "true",
          bclosed: match[13] === "true",
          bready: match[14] === "true",
          bloaded: match[15] === "true",
          bleave: match[16] === "true",
        });
      }

      // Clean up the text variable to free memory
      text = null;

      var result: ParseResult = {
        fileName: file.name,
        status: "completed",
        data: gameInfo,
      };

      self.postMessage(result);
    } catch (err: any) {
      var errorResult: ParseResult = {
        fileName: file.name,
        status: "error",
        data: null,
        error: err.message ?? "Unknown parsing error",
      };
      self.postMessage(errorResult);
    }
  };

  reader.onerror = () => {
    var errorResult: ParseResult = {
      fileName: file.name,
      status: "error",
      data: null,
      error: "Error reading file",
    };
    self.postMessage(errorResult);
  };

  reader.readAsText(file);
};