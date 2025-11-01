import { useState, useEffect, useRef } from "react";
import { WorkerPool } from "./workerPool";
import { ParseResult, type GameInfo } from "./fileParser.worker";
import "./App.css";
import { pop } from "./howler/pop";
import { successHowl } from "./howler/success";
import steamImg from "./images/cropped_steam_image.png";
import { CHEATERS_LANID } from "./CHEATERS_LANID";
type ResultRow = ParseResult & { key: string };

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
            const gid = result?.data && (result.data as any).gameId;
            if (gid && prev.some((r) => (r.data as any)?.gameId === gid)) {
              return prev;
            }
            return [
              ...prev,
              {
                key: `${file.name}-${Date.now()}-${Math.random()}`,
                fileName: result.fileName,
                data: result.data,
                status: result.status,
              },
            ];
          });
          pop.play();
        } catch (error) {
          console.error("Error processing file:", error);
          setFileResults((prev) => [
            ...prev,
            {
              key: `${file.name}-${Date.now()}-${Math.random()}`,
              fileName: file.name,
              data: null,
              status: "error",
            },
          ]);
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
      <ul style={{ margin: 0, paddingLeft: 16 }}>
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
                      style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <img src={steamImg} alt="Steam" style={{ width: 16, height: 16 }} />
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

        <div className="stack" style={{ width: "100%" }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".rep"
            multiple
            onChange={handleFileInputChange}
            style={{ display: "none" }}
          />
          <button
            className="btn"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
          >
            Select Files to Parse
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
