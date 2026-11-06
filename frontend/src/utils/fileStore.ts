/** Tiny IndexedDB store for the file contents behind history entries (browser-local only). */
export interface StoredFiles {
  id: string;
  original: { name: string; text: string };
  modified: { name: string; text: string };
}

const DB = 'xml-compare';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Every call swallows storage failures (private mode, quota): history just can't re-open then. */
export async function putFiles(f: StoredFiles): Promise<boolean> {
  try {
    await run('readwrite', (s) => s.put(f));
    return true;
  } catch {
    return false;
  }
}

export async function getFiles(id: string): Promise<StoredFiles | null> {
  try {
    return (await run<StoredFiles | undefined>('readonly', (s) => s.get(id))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteFiles(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      ids.forEach((id) => tx.objectStore(STORE).delete(id));
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    });
    db.close();
  } catch {
    /* ignore */
  }
}
