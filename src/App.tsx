import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { WorkerPool, type ParseResultStatus } from "./workerPool";
import { ParseResult } from "./fileParser.worker";
import "./App.css";
import { pop } from "./howler/pop";
import { successHowl } from "./howler/success";
import { saveResults, loadResults, clearResults } from "./indexedDBUtils";
import { PlayersList } from "./PlayersList";

type ResultRow = ParseResult & {
  key: string;
  uploadedAt: number;
  validPlayers: ProcessedPlayer[]; // Pre-filtered players
};

type ProcessedPlayer = {
  // We can keep the raw player structure or pick what we need
  // For now, let's keep it flexible but add our computed fields
  original: any;
  name: string;
  id: number;
  lanid: number;
  color: number;
  team: number;
  steamId?: string | number | undefined;
  steamName?: string;
  extraSteamLinks: Array<{ id: string | number; name?: string }>;
};

type ProcessedData = {
  results: ResultRow[];
  lanidNames: Record<string, string[]>;
};

const useWorkerPool = () => {
  const [workerPool, setWorkerPool] = useState<WorkerPool | null>(null);

  useEffect(() => {
    console.time("worker-pool-init");
    const pool = new WorkerPool();
    setWorkerPool(pool);
    console.timeEnd("worker-pool-init");
    return () => {
      pool.terminate();
    };
  }, []);

  return workerPool;
};

const buildLanidNamesFromResults = (
  results: ResultRow[],
): Record<string, string[]> => {
  console.time("build-lanid-names");
  const result = results
    .flatMap((r) => r.data?.players ?? [])
    .reduce(
      (acc, { lanid, name }) => {
        if (!name) return acc;
        const key = String(lanid);
        if (!acc[key]?.includes(name)) (acc[key] ??= []).push(name);
        return acc;
      },
      {} as Record<string, string[]>,
    );

  console.timeEnd("build-lanid-names");
  return result;
};

// Moved from PlayersList to be used here
// Moved from PlayersList to be used here
const processPlayers = (players: any[]): ProcessedPlayer[] => {
  return players
    .filter((p) => {
      const bexists = (p as any)?.bexists === true;
      const lanidZero = p.lanid === 0;
      const nameStr = (p as any)?.name ? String((p as any).name) : "";
      const isPlaceholderName = nameStr.trim().toLowerCase() === "name";
      const isEmptySlot = lanidZero && isPlaceholderName;
      return bexists && !isEmptySlot;
    })
    .map((p) => {
      const primary = (p as any)?.sic as number | string | undefined;
      const primaryStr = primary != null ? String(primary) : "0";

      const extras = [
        { id: (p as any)?.si1, name: (p as any)?.sn1 },
        { id: (p as any)?.si2, name: (p as any)?.sn2 },
        { id: (p as any)?.si3, name: (p as any)?.sn3 },
      ]
        .filter(
          (e) =>
            e.id != null && String(e.id) !== "0" && String(e.id) !== primaryStr,
        )
        .map((e) => ({ id: e.id, name: e.name }));

      return {
        original: p,
        name: p.name,
        id: p.id,
        lanid: p.lanid,
        color: p.color,
        team: p.team,
        steamId: primary,
        steamName: (p as any)?.snc,
        extraSteamLinks: extras,
      };
    });
};

const useFileResults = () => {
  const [processedData, setProcessedData] = useState<ProcessedData>({
    results: [],
    lanidNames: {},
  });

  // Helper to recompute derived data
  const updateState = (newResults: ResultRow[]) => {
    // Sort once
    const sorted = newResults.sort(
      (a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0),
    );
    // Compute lanidNames once
    const lanidNames = buildLanidNamesFromResults(sorted);

    setProcessedData({
      results: sorted,
      lanidNames,
    });
  };

  // Load on mount only
  useEffect(() => {
    console.time("load-results");
    loadResults()
      .then((loadedResults) => {
        const valid = Array.isArray(loadedResults)
          ? (loadedResults as ResultRow[])
          : [];

        // Pre-process: add validPlayers to each row
        const prepared = valid.map((r) => ({
          ...r,
          validPlayers: r.data?.players
            ? processPlayers(r.data.players)
            : [],
        }));

        updateState(prepared);
        console.timeEnd("load-results");
      })
      .catch((e) => {
        console.error("Failed to load results", e);
        console.timeEnd("load-results");
      });
  }, []);

  // Helper to save with error handling
  const persistResults = useCallback((results: ResultRow[]) => {
    console.time("save-results");
    saveResults(results)
      .then(() => console.timeEnd("save-results"))
      .catch((e) => {
        console.error("Failed to save results", e);
        console.timeEnd("save-results");
      });
  }, []);

  const addResult = useCallback(
    (result: ParseResult, fileName: string) => {
      console.time(`add-result-${fileName}`);

      setProcessedData((prev) => {
        const gameId = result.data?.gameId;
        const existingIndex = gameId
          ? prev.results.findIndex((r) => r.data?.gameId === gameId)
          : -1;

        const newRow: ResultRow = {
          key: gameId || `${fileName}-${Date.now()}-${Math.random()}`,
          uploadedAt: Date.now(),
          fileName,
          data: result.data ?? null,
          status: result.status,
          validPlayers: result.data?.players
            ? processPlayers(result.data.players)
            : [],
        };

        const currentList = prev.results;
        const updatedList =
          existingIndex !== -1
            ? currentList.map((r, i) => (i === existingIndex ? newRow : r))
            : [newRow, ...currentList];

        // IndexedDB is async
        persistResults(updatedList);

        // Re-process for state
        const sorted = updatedList.sort(
          (a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0),
        );
        const lanidNames = buildLanidNamesFromResults(sorted);

        console.timeEnd(`add-result-${fileName}`);
        return { results: sorted, lanidNames };
      });
    },
    [persistResults],
  );

  const addErrorResult = useCallback(
    (fileName: string, batchTime: number) => {
      console.time(`add-error-result-${fileName}`);

      setProcessedData((prev) => {
        const newRow: ResultRow = {
          key: `${fileName}-${Date.now()}-${Math.random()}`,
          uploadedAt: batchTime,
          fileName,
          data: null,
          status: "error" as ParseResultStatus,
          validPlayers: [],
        };

        const updatedList = [newRow, ...prev.results];

        persistResults(updatedList);

        // Re-process
        const sorted = updatedList.sort(
          (a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0),
        );
        const lanidNames = buildLanidNamesFromResults(sorted);

        console.timeEnd(`add-error-result-${fileName}`);
        return { results: sorted, lanidNames };
      });
    },
    [persistResults],
  );

  const clearAllResults = useCallback(async () => {
    console.time("clear-all-results");
    await clearResults().catch((e) =>
      console.error("Failed to clear results", e),
    );
    setProcessedData({ results: [], lanidNames: {} });
    console.timeEnd("clear-all-results");
  }, []);

  return {
    ...processedData,
    addResult,
    addErrorResult,
    clearAllResults,
  };
};

const processFilesBatch = async (
  workerPool: WorkerPool,
  files: File[],
  batchTime: number,
  addResult: (r: ParseResult, n: string) => void,
  addErrorResult: (n: string, t: number) => void,
  parallel: boolean,
): Promise<void> => {
  const batchType = parallel ? "parallel" : "sequential";
  console.time(`process-batch-${batchType}-${files.length}-files`);

  const processOne = async (file: File) => {
    console.time(`process-file-${file.name}`);
    try {
      const result = await workerPool.processFile(file);
      addResult(result, result.fileName);
      pop.play();
    } catch (error) {
      console.error("Error processing file:", error);
      addErrorResult(file.name, batchTime);
    } finally {
      console.timeEnd(`process-file-${file.name}`);
    }
  };

  if (parallel) {
    await Promise.allSettled(files.map(processOne));
  } else {
    for (const file of files) await processOne(file);
  }

  console.timeEnd(`process-batch-${batchType}-${files.length}-files`);
};

const FileInput = ({
  fileInputRef,
  loading,
  onFileSelect,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  onFileSelect: (files: FileList) => void;
}) => (
  <>
    <input
      type="file"
      ref={fileInputRef}
      accept=".rep"
      multiple
      onChange={(e) => {
        const files = e.target.files;
        if (files?.length) {
          onFileSelect(files);
          e.target.value = "";
        }
      }}
      className="hidden-input"
    />
    <button
      className="btn"
      disabled={loading}
      onClick={() => fileInputRef.current?.click()}
    >
      Select Files to Parse
    </button>
  </>
);

const ClearHistoryButton = ({
  loading,
  hasResults,
  onClearHistory,
}: {
  loading: boolean;
  hasResults: boolean;
  onClearHistory: () => void;
}) => (
  <button
    className="btn btn-danger"
    disabled={loading || !hasResults}
    onClick={onClearHistory}
    title={!hasResults ? "No history to clear" : "Clear saved results"}
  >
    Clear History
  </button>
);

const ResultsTable = ({
  results,
  lanidNames,
}: {
  results: ResultRow[];
  lanidNames: Record<string, string[]>;
}) => {
  console.time("render-results-table");
  const table = (
    <table className="results-table">
      <thead>
        <tr>
          <th>#</th>
          <th>File Name</th>
          <th>Players</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {results.map((row, idx) => (
          <tr key={row.key}>
            <td>{idx + 1}</td>
            <td>{row.fileName}</td>
            <td>
              <PlayersList
                validPlayers={row.validPlayers}
                lanidNames={lanidNames}
              />
            </td>
            <td>{row.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  console.timeEnd("render-results-table");
  return table;
};

function App() {
  const workerPool = useWorkerPool();
  const {
    results,
    lanidNames,
    addResult,
    addErrorResult,
    clearAllResults,
  } = useFileResults();
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFiles = useCallback(
    async (files: FileList) => {
      console.time("total-process-files");
      if (!workerPool) return console.error("Worker pool not initialized");

      setLoading(true);
      try {
        console.time("file-sorting");
        const LIMIT = 30 * 1024 * 1024;
        const batchTime = Date.now();
        const [small, large] = Array.from(files).reduce<[File[], File[]]>(
          ([s, l], f) => (f.size <= LIMIT ? [[...s, f], l] : [s, [...l, f]]),
          [[], []],
        );
        console.timeEnd("file-sorting");

        await Promise.all([
          processFilesBatch(
            workerPool,
            small,
            batchTime,
            addResult,
            addErrorResult,
            true,
          ),
          processFilesBatch(
            workerPool,
            large,
            batchTime,
            addResult,
            addErrorResult,
            false,
          ),
        ]);

        successHowl.play();
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        console.timeEnd("total-process-files");
      }
    },
    [workerPool, addResult, addErrorResult],
  );

  return (
    <div className="app-container">
      <div className="main-card card">
        <h2>Cossacks 3 Replays Parser</h2>
        <p>Upload `.rep` files to parse and display player info.</p>

        <div className="stack stack--full">
          <FileInput
            fileInputRef={fileInputRef}
            loading={loading}
            onFileSelect={processFiles}
          />
          <ClearHistoryButton
            loading={loading}
            hasResults={results.length > 0}
            onClearHistory={clearAllResults}
          />
          {loading && (
            <div className="spinner" aria-live="polite">
              Processing files...
            </div>
          )}
          {results.length > 0 && (
            <ResultsTable results={results} lanidNames={lanidNames} />
          )}
        </div>
      </div>
    </div>
  );
}

export { App };
