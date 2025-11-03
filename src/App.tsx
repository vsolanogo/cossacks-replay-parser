import { useState, useEffect, useRef } from "react";
import { WorkerPool, type ParseResultStatus } from "./workerPool";
import { ParseResult, type GameInfo } from "./fileParser.worker";
import "./App.css";
import { pop } from "./howler/pop";
import { successHowl } from "./howler/success";
import steamImg from "./images/cropped_steam_image.png";
import { CHEATERS_LANID } from "./CHEATERS_LANID";
import { saveResults, loadResults, clearResults } from "./indexedDBUtils";
type ResultRow = ParseResult & { key: string; uploadedAt: number };

function App() {
  const [workerPool, setWorkerPool] = useState<WorkerPool | null>(null);
  const [fileResults, setFileResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lanidNames, setLanidNames] = useState<Record<string | number, Set<string>>>({});

  useEffect(() => {
    const pool = new WorkerPool();
    setWorkerPool(pool);

    return () => {
      if (pool) pool.terminate();
    };
  }, []);

  // Load results from IndexedDB on component mount
  useEffect(() => {
    const loadFromIndexedDB = async () => {
      try {
        const results = await loadResults() as ResultRow[];
        if (Array.isArray(results)) {
          // Ensure consistent ordering: newest first
          const sorted = [...results].sort(
            (a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0)
          );
          setFileResults(sorted);
          const names: Record<string | number, Set<string>> = {};
          for (const row of sorted) {
            const players = (row?.data?.players ?? []) as any[];
            for (const p of players) {
              const key = (p as any)?.lanid as string | number;
              const name = (p as any)?.name ? String((p as any).name) : "";
              const existing = names[key] ? new Set(names[key]) : new Set<string>();
              if (name) existing.add(name);
              names[key] = existing;
            }
          }
          setLanidNames(names);
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

  const clearStoredResults = async () => {
    try {
      await clearResults();
    } catch (e) {
      console.error("Failed to clear IndexedDB", e);
    }
    setFileResults([]);
  };


  const processFiles = async (files: FileList | File[]) => {
    if (!workerPool) {
      console.error("Worker pool not initialized");
      return;
    }

    setLoading(true);
    try {
      const fileArray = Array.from(files);
      // prevent memory overflow when large files present usually rating replays weight few
      const LIMIT = 30 * 1024 * 1024;
      const smallFiles = fileArray.filter((f) => f.size <= LIMIT);
      const largeFiles = fileArray.filter((f) => f.size > LIMIT);
      // single timestamp per selection to keep the whole batch together
      const batchTime = Date.now();

      const processOne = async (file: File) => {
        try {
          const result = await workerPool.processFile(file);
          if (Array.isArray(result?.data?.players)) {
            const playersFromFile = result.data.players as NonNullable<typeof result.data>["players"];
            setLanidNames((prev) => {
              const next: Record<string | number, Set<string>> = { ...prev };
              for (const pl of playersFromFile) {
                const key = pl.lanid as string | number;
                const name = String(pl.name ?? "");
                const existing = next[key] ? new Set(next[key]) : new Set<string>();
                if (name) existing.add(name);
                next[key] = existing;
              }
              return next;
            });
          }
          setFileResults((prev) => {
            const gid: string | undefined = (result?.data as any)?.gameId;
            // de-dupe by gameId when available, but promote to top if re-uploaded
            if (gid) {
              const idx = prev.findIndex((r) => (r.data as any)?.gameId === gid);
              if (idx !== -1) {
                const existing = prev[idx];
                const updated: typeof existing = {
                  ...existing,
                  uploadedAt: Date.now(),
                  fileName: result.fileName,
                  data: result.data,
                  status: result.status,
                };
                const next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
                return next.slice().sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
              }
            }
            const key = gid ?? `${file.name}-${Date.now()}-${Math.random()}`;
            const next = [
              {
                key,
                uploadedAt: batchTime,
                fileName: result.fileName,
                data: result.data,
                status: result.status,
              },
              ...prev,
            ];
            return next.slice().sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
          });
          pop.play();
        } catch (error) {
          console.error("Error processing file:", error);
          setFileResults((prev) => {
            const next = [
              {
                key: `${file.name}-${Date.now()}-${Math.random()}`,
                uploadedAt: batchTime,
                fileName: file.name,
                data: null,
                status: "error" as ParseResultStatus,
              },
              ...prev,
            ];
            return next.slice().sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
          });
        }
      };

      const smallTasks = smallFiles.map((file) => processOne(file));
      await Promise.allSettled(smallTasks);

      for await (const file of largeFiles) {
        await processOne(file);
      }

      successHowl.play();

    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void processFiles(files);
      // Reset input so selecting the same files again triggers change
      e.target.value = "";
    }
  };



  const renderPlayers = (data?: GameInfo | null) => {
    const players = (data?.players ?? []).filter((p) => {
      const bexists = (p as any)?.bexists === true;
      const lanidZero = p.lanid === 0;
      const nameStr = (p as any)?.name ? String((p as any).name) : "";
      const isPlaceholderName = nameStr.trim().toLowerCase() === "name";
      // Hide obvious empty slots like: name (id: N) lanid 0 team 0 color X
      const isEmptySlot = lanidZero && isPlaceholderName;
      return bexists && !isEmptySlot;
    });
    if (!players.length) return "—";
    return (
      <ul className="players-list">
        {players.map((p, i) => (
          <li key={`${p.id}-${p.lanid}-${p.color}-${i}`}>
            {p.name} (id: {p.id})
            {(() => {
              const sic = (p as any)?.sic as number | string | undefined;
              const sicStr = sic != null ? String(sic) : "0";
              if (sicStr !== "0") {
                try {
                  const A = 76561197960265728n;
                  const url = `https://steamcommunity.com/profiles/${(A + BigInt(sicStr)).toString()}`;
                  const snc = (p as any)?.snc as string | undefined;
                  return (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={snc ? `Open Steam profile: ${snc}` : "Open Steam profile"}
                      className="steam-link"
                    >
                      <img src={steamImg} alt="Steam" className="steam-icon" />
                      {snc ? <span>{snc}</span> : null}
                    </a>
                  );
                } catch {
                  return null;
                }
              }
              return null;
            })()} {" "}lanid {" "}
            {(() => {
              const namesSet = lanidNames[p.lanid] || new Set<string>();
              const namesArr = Array.from(namesSet);
              const hasMultiple = namesArr.length > 1;
              const otherNames = namesArr.filter((n) => n !== p.name);
              return (
                <span className="lanid-badge-wrapper">
                  <span className={`lanid-badge${hasMultiple ? " lanid-badge--multi" : ""}`}>{p.lanid}</span>
                  {CHEATERS_LANID.includes(p.lanid) && (
                    <span className="cheater-badge" title="Reported cheater">🚨 cheater</span>
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
            })()}
            {" "}team {p.team} color {p.color}
          </li>
        ))}
      </ul>
    );
  };

  console.log(fileResults)

  return (
    <div className="app-container">
      <div className="main-card card">
        <h2>Cossacks 3 Replays Parser</h2>
        <p>Upload `.rep` files to parse and display player info.</p>

        <div className="stack stack--full">
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
          <button
            className="btn btn-danger"
            disabled={loading || fileResults.length === 0}
            onClick={clearStoredResults}
            title={fileResults.length === 0 ? "No history to clear" : "Clear saved results"}
          >
            Clear History
          </button>

          {loading && (
            <div className="spinner" aria-live="polite">
              Processing files...
            </div>
          )}

          {fileResults.length > 0 && (
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
                    <td>{renderPlayers(row.data)}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export { App };
