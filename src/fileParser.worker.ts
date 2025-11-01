/// <reference lib="webworker" />
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
  // New fields for additional player info
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

const mapRegex =
  /(?:^|\s)UID(\d+).*?gMap name (\S+).*?mapsize (\d+).*?terraintype (\d+).*?relieftype (\d+)/s;

self.onmessage = (e: MessageEvent<File>) => {
  const file = e.data;

  const reader = new FileReader();

  reader.onload = (event: ProgressEvent<FileReader>) => {
    try {
      let text: string = (event.target?.result ?? "") as string;
      // Оставляем printable ASCII — как раньше
      text = text.replace(/[^ -~]+/g, " ");

      const gameMatch = mapRegex.exec(text);

      if (!gameMatch) {
        throw new Error("Game info not found in file");
      }

      const gameInfo: GameInfo = {
        gameId: gameMatch[1],
        gMapName: gameMatch[2],
        mapSize: parseInt(gameMatch[3], 10),
        terrainType: parseInt(gameMatch[4], 10),
        reliefType: parseInt(gameMatch[5], 10),
        players: []
      };

      // --- 1) Извлекаем блоки игроков (включая все поля внутри блока) ---
      // Берём всё от "* id <n>" до следующего "* id" или до "playersinfo" или до конца
      const playerBlockRegex = /(\* id \d+[\s\S]*?)(?=\* id |\bplayersinfo\b|$)/g;
      let blockMatch: RegExpExecArray | null;
      const playerBlocks: string[] = [];
      while ((blockMatch = playerBlockRegex.exec(text)) !== null) {
        playerBlocks.push(blockMatch[1]);
      }

      // Функция очистки имени для более надёжного сравнения (убирает цветовые теги типа %color(...)% и лишние пробелы)
      const normalizeName = (s: string | undefined) =>
        (s ?? "").replace(/%color\([^\)]*\)%/gi, "").replace(/\s+/g, " ").trim().toLowerCase();

      for (const block of playerBlocks) {
        // Внутри блока ищем конкретные поля (без предположения о строгом порядке)
        const idM = block.match(/\* id (\-?\d+)/);
        const cidM = block.match(/cid (\-?\d+)/);
        // csid может отсутствовать как отдельный токен, но мы попробуем извлечь любое слово после "csid" или "csid name"
        const csidM = block.match(/csid\s+([^\s]+)/);
        // Имя берём между "name" и "team" (может содержать пробелы)
        const nameM = block.match(/name\s+([\s\S]*?)\s+team\b/);
        const teamM = block.match(/team\s+(\-?\d+)/);
        const colorM = block.match(/color\s+(\-?\d+)/);
        const lanidM = block.match(/lanid\s+(\-?\d+)/);
        const startxM = block.match(/startx\s+(\-?\d+)/);
        const startyM = block.match(/starty\s+(\-?\d+)/);
        const aidM = block.match(/aidifficulty\s+(\-?\d+)/);
        const bexistsM = block.match(/bexists\s+(true|false)/);
        const baiM = block.match(/bai\s+(true|false)/);
        const bhumanM = block.match(/bhuman\s+(true|false)/);
        const bclosedM = block.match(/bclosed\s+(true|false)/);
        const breadyM = block.match(/bready\s+(true|false)/);
        const bloadedM = block.match(/bloaded\s+(true|false)/);
        const bleaveM = block.match(/bleave\s+(true|false)/);

        const player: Player = {
          id: idM ? parseInt(idM[1], 10) : -1,
          cid: cidM ? parseInt(cidM[1], 10) : NaN,
          csid: csidM ? csidM[1] : "",
          name: nameM ? nameM[1].trim() : (csidM ? csidM[1] : ""),
          team: teamM ? parseInt(teamM[1], 10) : 0,
          color: colorM ? parseInt(colorM[1], 10) : 0,
          lanid: lanidM ? parseInt(lanidM[1], 10) : 0,
          startx: startxM ? parseInt(startxM[1], 10) : 0,
          starty: startyM ? parseInt(startyM[1], 10) : 0,
          aidifficulty: aidM ? parseInt(aidM[1], 10) : 0,
          bexists: bexistsM ? bexistsM[1] === "true" : false,
          bai: baiM ? baiM[1] === "true" : false,
          bhuman: bhumanM ? bhumanM[1] === "true" : false,
          bclosed: bclosedM ? bclosedM[1] === "true" : false,
          bready: breadyM ? breadyM[1] === "true" : false,
          bloaded: bloadedM ? bloadedM[1] === "true" : false,
          bleave: bleaveM ? bleaveM[1] === "true" : false,
        };

        gameInfo.players.push(player);
      }

      // --- 2) Извлекаем playersinfo блок и отдельные записи sic ---
      const playersInfoSectionM = text.match(/\bplayersinfo\b([\s\S]*?)(?=\bPatternList\b|\bF\b|$)/);
      const playersInfoEntries: Array<{
        sic: number;
        si1: number;
        si2: number;
        si3: number;
        snc: string;
        sn1: string;
        sn2: string;
        sn3: string;
      }> = [];

      if (playersInfoSectionM) {
        const infoText = playersInfoSectionM[1];
        // Выделяем каждую запись, начинающуюся с "* sic"
        const infoEntryRegex = /(\* sic [\s\S]*?)(?=\* sic |\n\*|$)/g;
        let infoMatch: RegExpExecArray | null;
        while ((infoMatch = infoEntryRegex.exec(infoText)) !== null) {
          const entry = infoMatch[1];
          const sicM = entry.match(/sic\s+(\d+)/);
          const si1M = entry.match(/si1\s+(\d+)/);
          const si2M = entry.match(/si2\s+(\d+)/);
          const si3M = entry.match(/si3\s+(\d+)/);
          const sncM = entry.match(/snc\s+([^\s]+)/);
          // sn* могут быть пустыми или отсутствовать
          const sn1M = entry.match(/sn1\s+([^\s]+)/);
          const sn2M = entry.match(/sn2\s+([^\s]+)/);
          const sn3M = entry.match(/sn3\s+([^\s]+)/);

          playersInfoEntries.push({
            sic: sicM ? parseInt(sicM[1], 10) : 0,
            si1: si1M ? parseInt(si1M[1], 10) : 0,
            si2: si2M ? parseInt(si2M[1], 10) : 0,
            si3: si3M ? parseInt(si3M[1], 10) : 0,
            snc: sncM ? sncM[1] : "",
            sn1: sn1M ? sn1M[1] : "",
            sn2: sn2M ? sn2M[1] : "",
            sn3: sn3M ? sn3M[1] : "",
          });
        }
      }

      // --- 3) Сопоставляем playersInfoEntries с игроками ---
      // Стратегия:
      // 1) По snc ↔ normalizeName(player.name)
      // 2) По cid совпадению (если snc пустой)
      // 3) fallback: по порядку (index)
      const usedPlayerIdx = new Set<number>();

      // helper: try match by name (case-insensitive, normalized)
      const nameToPlayerIndex = new Map<string, number[]>();
      gameInfo.players.forEach((p, idx) => {
        const n = normalizeName(p.name);
        if (!nameToPlayerIndex.has(n)) nameToPlayerIndex.set(n, []);
        nameToPlayerIndex.get(n)!.push(idx);
      });

      let fallbackIndex = 0;
      for (let i = 0; i < playersInfoEntries.length; i++) {
        const info = playersInfoEntries[i];
        let matchedIdx: number | null = null;

        const normSnc = normalizeName(info.snc);

        // 1) Try name match if snc present
        if (normSnc) {
          const candidates = nameToPlayerIndex.get(normSnc) ?? [];
          // pick first unused candidate
          for (const c of candidates) {
            if (!usedPlayerIdx.has(c)) {
              matchedIdx = c;
              break;
            }
          }
        }

        // 2) Try cid match: some snc may be different; but we can attempt to match by cid if available.
        if (matchedIdx === null) {
          // try to find player with same cid as si1/si2? Usually info doesn't carry cid; skip unless you have other mapping.
          // (we keep placeholder for future improvement)
        }

        // 3) fallback by order (first unused player)
        if (matchedIdx === null) {
          while (fallbackIndex < gameInfo.players.length && usedPlayerIdx.has(fallbackIndex)) {
            fallbackIndex++;
          }
          if (fallbackIndex < gameInfo.players.length) {
            matchedIdx = fallbackIndex;
            fallbackIndex++;
          } else {
            matchedIdx = null;
          }
        }

        if (matchedIdx !== null && matchedIdx >= 0 && matchedIdx < gameInfo.players.length) {
          const p = gameInfo.players[matchedIdx];
          p.sic = info.sic;
          p.si1 = info.si1;
          p.si2 = info.si2;
          p.si3 = info.si3;
          p.snc = info.snc || undefined;
          p.sn1 = info.sn1 || undefined;
          p.sn2 = info.sn2 || undefined;
          p.sn3 = info.sn3 || undefined;
          usedPlayerIdx.add(matchedIdx);
        } else {
          // no player to attach to; ignore or log (we choose ignore)
        }
      }

      // Очистка временных больших строк
      text = "";

      const result: ParseResult = {
        fileName: file.name,
        status: "completed",
        data: gameInfo,
      };

      self.postMessage(result);
    } catch (err: any) {
      const errorResult: ParseResult = {
        fileName: file.name,
        status: "error",
        data: null,
        error: err?.message ?? "Unknown parsing error",
      };
      self.postMessage(errorResult);
    }
  };

  reader.onerror = () => {
    const errorResult: ParseResult = {
      fileName: file.name,
      status: "error",
      data: null,
      error: "Error reading file",
    };
    self.postMessage(errorResult);
  };

  reader.readAsText(file);
};
