/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import type { ParseResult, GameInfo, Player } from './types';

const mapRegex =
  /(?:^|\s)UID(\d+).*?gMap name (\S+).*?mapsize (\d+).*?terraintype (\d+).*?relieftype (\d+)/s;


self.onmessage = (e: MessageEvent<File>) => {
  const file = e.data;

  const reader = new FileReader();

  reader.onload = (event: ProgressEvent<FileReader>) => {
    try {
      let text: string = (event.target?.result ?? "") as string;
      // Keep printable ASCII — as before
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

      // --- 1) Sequential parsing of players section, as in C++ ---
      const playersSectionM = text.match(/\bplayers\b([\s\S]*?)(?=\bplayersinfo\b|\bPatternList\b|\bF\b|$)/);
      let src = playersSectionM ? playersSectionM[1] : text;

      const readNext = (source: string, re: RegExp): { value: string; rest: string } => {
        const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
        const m = rx.exec(source);
        if (!m) return { value: "", rest: source };
        const end = m.index + m[0].length;
        return { value: m[1], rest: source.slice(end) };
      };

      const seqPlayers: Player[] = [];
      for (let k = 0; k < 12; k++) {
        // read in the same order as C++ keys vector
        const cidT = readNext(src, /cid\s+(-?\d+)/);
        src = cidT.rest;
        const csidT = readNext(src, /csid\s+([^\s]+)/);
        src = csidT.rest;

        // name: capture until next 'team', but do not advance past 'team' token so team is still readable
        const nameRx = /name\s+([\s\S]*?)\s+team\b/;
        const nameSearch = new RegExp(nameRx.source, "m");
        const nameM = nameSearch.exec(src);
        let nameVal = "";
        if (nameM) {
          nameVal = nameM[1].trim();
          // do NOT advance past 'team' keyword; cut source only up to the start of 'team'
          const cutPos = nameM.index + nameM[0].length - 4; // length of 'team'
          src = src.slice(cutPos);
        } else {
          // Fallback: name is a single token; consume it to keep alignment
          const nameT = readNext(src, /name\s+([^\s]+)/);
          nameVal = nameT.value || "";
          src = nameT.rest;
        }

        const teamT = readNext(src, /team\s+(-?\d+)/);
        src = teamT.rest;
        const colorT = readNext(src, /color\s+(-?\d+)/);
        src = colorT.rest;
        const lanidT = readNext(src, /lanid\s+(-?\d+)/);
        src = lanidT.rest;
        const startxT = readNext(src, /startx\s+(-?\d+)/);
        src = startxT.rest;
        const startyT = readNext(src, /starty\s+(-?\d+)/);
        src = startyT.rest;
        const aidT = readNext(src, /aidifficulty\s+(-?\d+)/);
        src = aidT.rest;
        const bexistsT = readNext(src, /bexists\s+(true|false)/);
        src = bexistsT.rest;
        const baiT = readNext(src, /bai\s+(true|false)/);
        src = baiT.rest;
        const bhumanT = readNext(src, /bhuman\s+(true|false)/);
        src = bhumanT.rest;
        const bclosedT = readNext(src, /bclosed\s+(true|false)/);
        src = bclosedT.rest;
        const breadyT = readNext(src, /bready\s+(true|false)/);
        src = breadyT.rest;
        const bloadedT = readNext(src, /bloaded\s+(true|false)/);
        src = bloadedT.rest;
        const bleaveT = readNext(src, /bleave\s+(true|false)/);
        src = bleaveT.rest;

        const player: Player = {
          id: k,
          cid: cidT.value ? parseInt(cidT.value, 10) : NaN,
          csid: csidT.value || "",
          name: nameVal || csidT.value || "",
          team: teamT.value ? parseInt(teamT.value, 10) : 0,
          color: colorT.value ? parseInt(colorT.value, 10) : 0,
          lanid: lanidT.value ? parseInt(lanidT.value, 10) : 0,
          startx: startxT.value ? parseInt(startxT.value, 10) : 0,
          starty: startyT.value ? parseInt(startyT.value, 10) : 0,
          aidifficulty: aidT.value ? parseInt(aidT.value, 10) : 0,
          bexists: bexistsT.value === "true",
          bai: baiT.value === "true",
          bhuman: bhumanT.value === "true",
          bclosed: bclosedT.value === "true",
          bready: breadyT.value === "true",
          bloaded: bloadedT.value === "true",
          bleave: bleaveT.value === "true",
        };
        seqPlayers.push(player);
      }

      // --- 1b) Alternative parsing by * id blocks ... (fallback) ---
      const playersSection = playersSectionM ? playersSectionM[1] : text;
      const playerBlockRegex = /(\* id \d+[\s\S]*?)(?=\* id |\bplayersinfo\b|$)/g;
      let blockMatch: RegExpExecArray | null;
      const playerBlocks: string[] = [];
      while ((blockMatch = playerBlockRegex.exec(playersSection)) !== null) {
        playerBlocks.push(blockMatch[1]);
      }

      const lastGroup = (s: string, re: RegExp): string | undefined => {
        let m: RegExpExecArray | null;
        let last: string | undefined;
        const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
        while ((m = rx.exec(s)) !== null) last = m[1];
        return last;
      };

      const blkPlayers: Player[] = [];
      for (let idx = 0; idx < playerBlocks.length; idx++) {
        const block = playerBlocks[idx];
        const idM = block.match(/\* id (\-?\d+)/);
        const cidStr = lastGroup(block, /cid\s+(-?\d+)/g);
        const csidM = block.match(/csid\s+([^\s]+)/);
        const nameM = block.match(/name\s+([\s\S]*?)\s+team\b/);
        const teamStr = lastGroup(block, /team\s+(-?\d+)/g);
        const colorStr = lastGroup(block, /color\s+(-?\d+)/g);
        const lanidStr = lastGroup(block, /lanid\s+(-?\d+)/g);
        const startxStr = lastGroup(block, /startx\s+(-?\d+)/g);
        const startyStr = lastGroup(block, /starty\s+(-?\d+)/g);
        const aidStr = lastGroup(block, /aidifficulty\s+(-?\d+)/g);
        const bexistsM = block.match(/bexists\s+(true|false)/);
        const baiM = block.match(/bai\s+(true|false)/);
        const bhumanM = block.match(/bhuman\s+(true|false)/);
        const bclosedM = block.match(/bclosed\s+(true|false)/);
        const breadyM = block.match(/bready\s+(true|false)/);
        const bloadedM = block.match(/bloaded\s+(true|false)/);
        const bleaveM = block.match(/bleave\s+(true|false)/);

        const p: Player = {
          id: idM ? parseInt(idM[1], 10) : idx,
          cid: cidStr != null ? parseInt(cidStr, 10) : NaN,
          csid: csidM ? csidM[1] : "",
          name: nameM ? nameM[1].trim() : (csidM ? csidM[1] : ""),
          team: teamStr != null ? parseInt(teamStr, 10) : 0,
          color: colorStr != null ? parseInt(colorStr, 10) : 0,
          lanid: lanidStr != null ? parseInt(lanidStr, 10) : 0,
          startx: startxStr != null ? parseInt(startxStr, 10) : 0,
          starty: startyStr != null ? parseInt(startyStr, 10) : 0,
          aidifficulty: aidStr != null ? parseInt(aidStr, 10) : 0,
          bexists: bexistsM ? bexistsM[1] === "true" : false,
          bai: baiM ? baiM[1] === "true" : false,
          bhuman: bhumanM ? bhumanM[1] === "true" : false,
          bclosed: bclosedM ? bclosedM[1] === "true" : false,
          bready: breadyM ? breadyM[1] === "true" : false,
          bloaded: bloadedM ? bloadedM[1] === "true" : false,
          bleave: bleaveM ? bleaveM[1] === "true" : false,
        };
        blkPlayers.push(p);
      }

      // Choose the better parsed result: prioritize more bexists===true
      const countExists = (arr: Player[]) => arr.reduce((acc, p) => acc + (p.bexists ? 1 : 0), 0);
      const chosen = countExists(blkPlayers) > countExists(seqPlayers) ? blkPlayers : seqPlayers;
      gameInfo.players.push(...chosen);

      // --- 2) Extract playersinfo block and individual sic entries ---
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
        // Extract each entry starting with "* sic"
        const infoEntryRegex = /(\* sic [\s\S]*?)(?=\* sic |\n\*|$)/g;
        let infoMatch: RegExpExecArray | null;
        while ((infoMatch = infoEntryRegex.exec(infoText)) !== null) {
          const entry = infoMatch[1];
          const sicM = entry.match(/sic\s+(\d+)/);
          const si1M = entry.match(/si1\s+(\d+)/);
          const si2M = entry.match(/si2\s+(\d+)/);
          const si3M = entry.match(/si3\s+(\d+)/);
          const sncM = entry.match(/snc\s+([^\s]+)/);
          // sn* can be empty or absent
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

      // --- 3) Match playersInfoEntries with players ---
      // Strategy:
      // 1) By snc ↔ normalizeName(player.name)
      // 2) By cid match (if snc is empty)
      // 3) fallback: by order (index)
      const usedPlayerIdx = new Set<number>();

      // helper: try match by name (case-insensitive, normalized)
      const normalizeName = (s: string | undefined) =>
        (s ?? "").replace(/%color\([^\)]*\)%/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
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

      // Cleanup temporary large strings
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
