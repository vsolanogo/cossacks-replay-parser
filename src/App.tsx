import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { WorkerPool, type ParseResultStatus } from "./workerPool";
import { ParseResult } from "./fileParser.worker";
import "./App.css";
import { pop } from "./howler/pop";
import { successHowl } from "./howler/success";
import { saveResults, loadResults, clearResults } from "./indexedDBUtils";
import { PlayersList } from "./PlayersList";

type ResultRow = ParseResult & { key: string; uploadedAt: number };

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

const useFileResults = () => {
  const [fileResults, setFileResults] = useState<ResultRow[]>([]);
  const [lanidNames, setLanidNames] = useState<Record<string, string[]>>({});

  // Load on mount only
  useEffect(() => {
    console.time("load-results");
    loadResults()
      .then((results) => {
        const valid = Array.isArray(results) ? (results as ResultRow[]) : [];
        setFileResults(valid);
        setLanidNames(buildLanidNamesFromResults(valid));
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
      const players = result.data?.players;

      if (players?.length) {
        setLanidNames((prev) => {
          const next = { ...prev };
          players.forEach(({ lanid, name }) => {
            if (!name) return;
            const key = String(lanid);
            if (!next[key]?.includes(name)) (next[key] ??= []).push(name);
          });
          return next;
        });
      }

      setFileResults((prev) => {
        const gameId = result.data?.gameId;
        const existingIndex = gameId
          ? prev.findIndex((r) => r.data?.gameId === gameId)
          : -1;

        const newRow: ResultRow = {
          key: gameId || `${fileName}-${Date.now()}-${Math.random()}`,
          uploadedAt: Date.now(),
          fileName,
          data: result.data ?? null,
          status: result.status,
        };

        const updated =
          existingIndex !== -1
            ? prev.map((r, i) => (i === existingIndex ? newRow : r))
            : [newRow, ...prev];

        // IndexedDB is async, doesn't block React's state update
        persistResults(updated);

        console.timeEnd(`add-result-${fileName}`);
        return updated;
      });
    },
    [persistResults],
  );

  const addErrorResult = useCallback(
    (fileName: string, batchTime: number) => {
      console.time(`add-error-result-${fileName}`);

      setFileResults((prev) => {
        const updated = [
          {
            key: `${fileName}-${Date.now()}-${Math.random()}`,
            uploadedAt: batchTime,
            fileName,
            data: null,
            status: "error" as ParseResultStatus,
          },
          ...prev,
        ];

        persistResults(updated);

        console.timeEnd(`add-error-result-${fileName}`);
        return updated;
      });
    },
    [persistResults],
  );

  const clearAllResults = useCallback(async () => {
    console.time("clear-all-results");
    await clearResults().catch((e) =>
      console.error("Failed to clear results", e),
    );
    setFileResults([]);
    setLanidNames({});
    console.timeEnd("clear-all-results");
  }, []);

  return {
    fileResults,
    lanidNames,
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
  fileResults,
  lanidNames,
}: {
  fileResults: ResultRow[];
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
        {fileResults
          .sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0))
          .map((row, idx) => (
            <tr key={row.key}>
              <td>{idx + 1}</td>
              <td>{row.fileName}</td>
              <td>
                <PlayersList data={row.data} lanidNames={lanidNames} />
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
    fileResults,
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
            hasResults={fileResults.length > 0}
            onClearHistory={clearAllResults}
          />
          {loading && (
            <div className="spinner" aria-live="polite">
              Processing files...
            </div>
          )}
          {fileResults.length > 0 && (
            <ResultsTable fileResults={fileResults} lanidNames={lanidNames} />
          )}
        </div>
      </div>
    </div>
  );
}

export { App };
