<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { WorkerPool } from '$lib/workerPool';
  import { saveResults, loadResults, clearResults } from '$lib/indexedDBUtils';
  import { pop, successHowl } from '$lib/sounds';
  import PlayersList from '$lib/components/PlayersList.svelte';
  import type { ResultRow, ParseResult } from '$lib/types';
  export const prerender = true;

  let workerPool: WorkerPool | null = null;
  let fileResults: ResultRow[] = [];
  let lanidNames: Record<string, string[]> = {};
  let loading = false;
  let fileInput: HTMLInputElement;
  let saveTimeout: number | null = null;

  onMount(() => {
    const initializeApp = async () => {
      workerPool = new WorkerPool();
      
      try {
        const results = await loadResults() as ResultRow[];
        if (Array.isArray(results)) {
          const sorted = results.slice().sort(
            (a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0)
          );
          fileResults = sorted;
          updateLanidNames(sorted);
        }
      } catch (e) {
        console.error("Failed to load fileResults from IndexedDB", e);
      }
    };

    // Запускаем асинхронную инициализацию
    initializeApp();

    // Возвращаем функцию очистки
    return () => {
      if (workerPool) workerPool.terminate();
    };
  });

  onDestroy(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
  });

  function updateLanidNames(results: ResultRow[]) {
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
    lanidNames = names;
  }

  async function saveToIndexedDB() {
    try {
      await saveResults(fileResults);
    } catch (e) {
      console.error("Failed to save fileResults to IndexedDB", e);
    }
  }

  // Реактивное выражение для сохранения в IndexedDB
  $: if (fileResults.length > 0) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(saveToIndexedDB, 2000);
  }

  function addResult(result: ParseResult, fileName: string, batchTime: number) {
    const playersFromFile = result.data?.players;
    if (Array.isArray(playersFromFile)) {
      lanidNames = (() => {
        const next = Object.keys(lanidNames).reduce<Record<string, string[]>>((acc, key) => {
          acc[key] = lanidNames[key].slice();
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
      })();
    }

    fileResults = (() => {
      const gid: string | undefined = result?.data?.gameId;
      
      if (gid) {
        const idx = fileResults.findIndex((r) => r.data?.gameId === gid);
        if (idx !== -1) {
          const existing = fileResults[idx];
          const updated: typeof existing = {
            ...existing,
            uploadedAt: Date.now(),
            fileName: fileName,
            data: result.data,
            status: result.status,
          };
          const next = [updated, ...fileResults.slice(0, idx), ...fileResults.slice(idx + 1)];
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
      const next = [newResult, ...fileResults];
      return next.slice().sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
    })();
  }

  function addErrorResult(fileName: string, batchTime: number) {
    fileResults = (() => {
      const errorResult = {
        key: `${fileName}-${Date.now()}-${Math.random()}`,
        uploadedAt: batchTime,
        fileName: fileName,
        data: null,
        status: "error" as const,
      };
      const next = [errorResult, ...fileResults];
      return next.slice().sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
    })();
  }

  async function processFile(file: File, batchTime: number) {
    try {
      const result = await workerPool!.processFile(file);
      addResult(result, result.fileName, batchTime);
      pop.play();
    } catch (error) {
      console.error("Error processing file:", error);
      addErrorResult(file.name, batchTime);
    }
  }

  async function processFiles(files: FileList) {
    if (!workerPool) {
      console.error("Worker pool not initialized");
      return;
    }

    loading = true;
    
    try {
      const fileArray: File[] = [];
      for (let i = 0; i < files.length; i++) {
        fileArray.push(files[i]);
      }

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

      const batchTime = Date.now();

      const smallTasks: Promise<void>[] = [];
      for (let i = 0; i < smallFiles.length; i++) {
        smallTasks.push(processFile(smallFiles[i], batchTime));
      }
      await Promise.allSettled(smallTasks);

      for (let i = 0; i < largeFiles.length; i++) {
        await processFile(largeFiles[i], batchTime);
      }

      successHowl.play();
    } finally {
      loading = false;
      if (fileInput) {
        fileInput.value = "";
      }
    }
  }

  function handleFileInputChange() {
    const files = fileInput.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }

  async function clearAllResults() {
    try {
      await clearResults();
    } catch (e) {
      console.error("Failed to clear IndexedDB", e);
    }
    fileResults = [];
    lanidNames = {};
  }
</script>
<div class="app-container">
  <div class="main-card card">
    <h2>Cossacks 3 Replays Parser</h2>
    <p>Upload `.rep` files to parse and display player info.</p>

    <div class="stack stack--full">
      <input
        type="file"
        bind:this={fileInput}
        accept=".rep"
        multiple
        on:change={handleFileInputChange}
        class="hidden-input"
      />
      <button
        class="btn"
        disabled={loading}
        on:click={() => fileInput.click()}
      >
        Select Files to Parse
      </button>

      <button
        class="btn btn-danger"
        disabled={loading || fileResults.length === 0}
        on:click={clearAllResults}
        title={fileResults.length === 0 ? "No history to clear" : "Clear saved results"}
      >
        Clear History
      </button>

      {#if loading}
        <div class="spinner" aria-live="polite">
          Processing files...
        </div>
      {/if}

      {#if fileResults.length > 0}
        <table class="results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>File Name</th>
              <th>Players</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each fileResults as row, idx}
              <tr>
                <td>{idx + 1}</td>
                <td>{row.fileName}</td>
                <td>
                  <PlayersList data={row.data} lanidNames={lanidNames} />
                </td>
                <td>{row.status}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</div>

<!-- <style>
  .app-container {
    position: relative;
    z-index: 1;
  }
</style> -->