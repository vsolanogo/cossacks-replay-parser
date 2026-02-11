import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { WorkerPool, type ParseResultStatus } from "./workerPool";
import { ParseResult, type GameInfo } from "./fileParser.worker";
import "./App.css";
import { pop } from "./howler/pop";
import { successHowl } from "./howler/success";
import { saveResults, loadResults, clearResults } from "./indexedDBUtils";
import { PlayersList } from "./PlayersList";

type ResultRow = ParseResult & { key: string; uploadedAt: number };

const useWorkerPool = () => {
  const [workerPool, setWorkerPool] = useState<WorkerPool | null>(null);

  useEffect(() => {
    const pool = new WorkerPool();
    setWorkerPool(pool);
    return () => {
      pool.terminate();
    };
  }, []);

  return workerPool;
};

const buildLanidNamesFromResults = (
  results: ResultRow[],
): Record<string, string[]> =>
  results
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

const useFileResults = () => {
  const [fileResults, setFileResults] = useState<ResultRow[]>([]);
  const [lanidNames, setLanidNames] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadResults()
      .then((results) => {
        const valid = Array.isArray(results) ? (results as ResultRow[]) : [];
        setFileResults(
          valid.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0)),
        );
        setLanidNames(buildLanidNamesFromResults(valid));
      })
      .catch((e) => console.error("Failed to load results", e));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      saveResults(fileResults).catch((e) =>
        console.error("Failed to save results", e),
      );
    }, 2000);
    return () => clearTimeout(handle);
  }, [fileResults]);

  const addResult = useCallback(
    (result: ParseResult, fileName: string, batchTime: number) => {
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
          data: result.data,
          status: result.status,
        };
        const updated =
          existingIndex !== -1
            ? prev.map((r, i) => (i === existingIndex ? newRow : r))
            : [newRow, ...prev];
        return updated.sort(
          (a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0),
        );
      });
    },
    [],
  );

  const addErrorResult = useCallback((fileName: string, batchTime: number) => {
    setFileResults((prev) =>
      [
        {
          key: `${fileName}-${Date.now()}-${Math.random()}`,
          uploadedAt: batchTime,
          fileName,
          data: null,
          status: "error" as ParseResultStatus,
        },
        ...prev,
      ].sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0)),
    );
  }, []);

  const clearAllResults = useCallback(async () => {
    await clearResults().catch((e) =>
      console.error("Failed to clear results", e),
    );
    setFileResults([]);
    setLanidNames({});
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
  addResult: (r: ParseResult, n: string, t: number) => void,
  addErrorResult: (n: string, t: number) => void,
  parallel: boolean,
): Promise<void> => {
  const processOne = async (file: File) => {
    try {
      const result = await workerPool.processFile(file);
      addResult(result, result.fileName, batchTime);
      pop.play();
    } catch (error) {
      console.error("Error processing file:", error);
      addErrorResult(file.name, batchTime);
    }
  };

  if (parallel) {
    await Promise.allSettled(files.map(processOne));
  } else {
    for (const file of files) await processOne(file);
  }
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
}) => (
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
      {fileResults.map((row, idx) => (
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
      if (!workerPool) return console.error("Worker pool not initialized");

      setLoading(true);
      try {
        const LIMIT = 30 * 1024 * 1024;
        const batchTime = Date.now();
        const [small, large] = Array.from(files).reduce<[File[], File[]]>(
          ([s, l], f) => (f.size <= LIMIT ? [[...s, f], l] : [s, [...l, f]]),
          [[], []],
        );

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
