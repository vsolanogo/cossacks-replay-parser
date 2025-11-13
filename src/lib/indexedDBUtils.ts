const DB_NAME = 'CossacksReplayDB' as const;
const DB_VERSION = 1 as const;
const STORE_NAME = 'fileResults' as const;

export type Keyed = { key: string };

/**
 * Open (and create/upgrade) the IndexedDB database
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Replace all existing results with the provided array.
 */
export async function saveResults<T extends Keyed>(results: T[]): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const clearReq = store.clear();

    clearReq.onsuccess = () => {
      for (const result of results) {
        store.add(result);
      }
    };

    clearReq.onerror = () => {
      reject(clearReq.error ?? new Error('Failed to clear object store'));
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/**
 * Load all saved results from the object store.
 */
export async function loadResults<T extends Keyed = Keyed>(): Promise<T[]> {
  const db = await initDB();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      resolve((req.result as T[]) ?? []);
    };

    req.onerror = () => {
      reject(req.error ?? new Error('Failed to read from object store'));
    };
  });
}

/**
 * Clear all stored results.
 */
export async function clearResults(): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('Failed to clear object store'));
  });
}
