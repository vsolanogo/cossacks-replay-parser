import { useState, useEffect, useRef, useCallback } from "react";
import { WorkerPool, type ParseResultStatus } from "./workerPool";
import { ParseResult, type GameInfo } from "./fileParser.worker";
import "./App.css";
import { pop } from "./howler/pop";
import { successHowl } from "./howler/success";
import { saveResults, loadResults, clearResults } from "./indexedDBUtils";
import { PlayersList } from "./PlayersList";

type ResultRow = ParseResult & { key: string; uploadedAt: number };

// Custom hook for managing worker pool
const useWorkerPool = () => {
  const [workerPool, setWorkerPool] = useState<WorkerPool | null>(null);

  useEffect(() => {
    const pool = new WorkerPool();
    setWorkerPool(pool);

    return () => {
      if (pool) pool.terminate();
    };
  }, []);

  return workerPool;
};

// Custom hook for managing file results with IndexedDB persistence
const useFileResults = () => {
  const [fileResults, setFileResults] = useState<ResultRow[]>([]);
  const [lanidNames, setLanidNames] = useState<Record<string, string[]>>({});

  // Load results from IndexedDB on component mount
  useEffect(() => {
    const loadFromIndexedDB = async () => {
      try {
        const results = await loadResults() as ResultRow[];
        if (Array.isArray(results)) {
          // Ensure consistent ordering: newest first
          const sorted = results.slice().sort(
            (a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0)
          );
          setFileResults(sorted);
          updateLanidNames(sorted);
        }
      } catch (e) {
        console.error("Failed to load fileResults from IndexedDB", e);
      }
    };

    loadFromIndexedDB();
  }, []);

  // Save results to IndexedDB whenever fileResults changes
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        await saveResults(fileResults);
      } catch (e) {
        console.error("Failed to save fileResults to IndexedDB", e);
      }
    }, 2000);

    return () => {
      clearTimeout(handle);
    };
  }, [fileResults]);

  // Helper function to update lanidNames based on file results
  const updateLanidNames = (results: ResultRow[]) => {
    const names: Record<string, string[]> = {};
    for (const row of results) {
      const players = row.data?.players ?? [];
      for (const player of players) {
        const key = String(player.lanid);
        const name = player.name || "";
        const existing = names[key] ?? [];
        if (name && !existing.includes(name)) {
          existing.push(name);
        }
        names[key] = existing;
      }
    }
    setLanidNames(names);
  };

  // Function to add a new result to the fileResults state
  const addResult = useCallback((result: ParseResult, fileName: string, batchTime: number) => {
    const playersFromFile = result.data?.players;
    if (Array.isArray(playersFromFile)) {
      setLanidNames((prev) => {
        const next = Object.keys(prev).reduce<Record<string, string[]>>((acc, key) => {
          acc[key] = prev[key].slice();
          return acc;
        }, {});
        for (const player of playersFromFile) {
          const key = String(player.lanid);
          const name = player.name || "";
          const existing = next[key] ?? [];
          if (name && !existing.includes(name)) {
            existing.push(name);
          }
          next[key] = existing;
        }
        return next;
      });
    }
    
    setFileResults((prev) => {
      const gid: string | undefined = result?.data?.gameId;
      // de-dupe by gameId when available, but promote to top if re-uploaded
      if (gid) {
        const idx = prev.findIndex((r) => r.data?.gameId === gid);
        if (idx !== -1) {
          const existing = prev[idx];
          const updated: typeof existing = {
            ...existing,
            uploadedAt: Date.now(),
            fileName: fileName,
            data: result.data,
            status: result.status,
          };
          const next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
          return next.slice().sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
        }
      }
      const key = gid || `${fileName}-${Date.now()}-${Math.random()}`;
      const newResult = {
        key,
        uploadedAt: batchTime,
        fileName: fileName,
        data: result.data,
        status: result.status,
      };
      const next = [newResult, ...prev];
      return next.slice().sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
    });
  }, []);

  // Function to add an error result
  const addErrorResult = useCallback((fileName: string, batchTime: number) => {
    setFileResults((prev) => {
      const errorResult = {
        key: `${fileName}-${Date.now()}-${Math.random()}`,
        uploadedAt: batchTime,
        fileName: fileName,
        data: null,
        status: "error" as ParseResultStatus,
      };
      const next = [errorResult, ...prev];
      return next.slice().sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
    });
  }, []);

  // Function to clear all results
  const clearAllResults = useCallback(async () => {
    try {
      await clearResults();
    } catch (e) {
      console.error("Failed to clear IndexedDB", e);
    }
    setFileResults([]);
    setLanidNames({});
  }, []);

  return {
    fileResults,
    lanidNames,
    addResult,
    addErrorResult,
    clearAllResults
  };
};

// Helper function to process a single file
const processFile = async (
  workerPool: WorkerPool,
  file: File,
  batchTime: number,
  addResult: (result: ParseResult, fileName: string, batchTime: number) => void,
  addErrorResult: (fileName: string, batchTime: number) => void
) => {
  try {
    const result = await workerPool.processFile(file);
    addResult(result, result.fileName, batchTime);
    pop.play();
  } catch (error) {
    console.error("Error processing file:", error);
    addErrorResult(file.name, batchTime);
  }
};

// File input component
const FileInput = ({ 
  fileInputRef, 
  loading, 
  onFileSelect 
}: { 
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  onFileSelect: (files: FileList) => void;
}) => {
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files);
      // Reset input so selecting the same files again triggers change
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".rep"
        multiple
        onChange={handleFileInputChange}
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
};

// Clear history button component
const ClearHistoryButton = ({ 
  loading, 
  hasResults, 
  onClearHistory 
}: { 
  loading: boolean;
  hasResults: boolean;
  onClearHistory: () => void;
}) => {
  return (
    <button
      className="btn btn-danger"
      disabled={loading || !hasResults}
      onClick={onClearHistory}
      title={!hasResults ? "No history to clear" : "Clear saved results"}
    >
      Clear History
    </button>
  );
};

// Results table component
const ResultsTable = ({ 
  fileResults, 
  lanidNames 
}: { 
  fileResults: ResultRow[];
  lanidNames: Record<string, string[]>;
}) => {
  return (
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
};

// Main App component
function App() {
  const workerPool = useWorkerPool();
  const { fileResults, lanidNames, addResult, addErrorResult, clearAllResults } = useFileResults();
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Process files function
  const processFiles = useCallback(async (files: FileList) => {
    if (!workerPool) {
      console.error("Worker pool not initialized");
      return;
    }

    setLoading(true);
    try {
      // Convert FileList to array without using Array.from
      const fileArray: File[] = [];
      for (let i = 0; i < files.length; i++) {
        fileArray.push(files[i]);
      }

      // prevent memory overflow when large files present usually rating replays weight few
      const LIMIT = 30 * 1024 * 1024;
      const smallFiles: File[] = [];
      const largeFiles: File[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        if (fileArray[i].size <= LIMIT) {
          smallFiles.push(fileArray[i]);
        } else {
          largeFiles.push(fileArray[i]);
        }
      }

      // single timestamp per selection to keep the whole batch together
      const batchTime = Date.now();

      // Process small files in parallel
      const smallTasks: Promise<void>[] = [];
      for (let i = 0; i < smallFiles.length; i++) {
        smallTasks.push(
          processFile(workerPool, smallFiles[i], batchTime, addResult, addErrorResult)
        );
      }
      await Promise.allSettled(smallTasks);

      // Process large files sequentially
      for (let i = 0; i < largeFiles.length; i++) {
        await processFile(workerPool, largeFiles[i], batchTime, addResult, addErrorResult);
      }

      successHowl.play();
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [workerPool, addResult, addErrorResult]);

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
            <ResultsTable 
              fileResults={fileResults} 
              lanidNames={lanidNames} 
            />
          )}
        </div>
      </div>
    </div>
  );
}

export { App };