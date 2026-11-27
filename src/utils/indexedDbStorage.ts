const DB_NAME = 'ambufleet_idb_v1';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no soportado'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Error abriendo IndexedDB'));
  });
  return dbPromise;
};

export const idbGet = async <T,>(key: string): Promise<T | null> => {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const idbSet = async (key: string, value: unknown): Promise<boolean> => {
  try {
    const db = await openDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
};

export const idbRemove = async (key: string): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignorar
  }
};

export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    if (navigator.storage && 'persist' in navigator.storage) {
      return await navigator.storage.persist();
    }
  } catch {
    // ignorar
  }
  return false;
};

export const estimateBrowserStorageQuota = async (): Promise<{
  usedBytes: number;
  quotaBytes: number;
  usagePercent: number;
} | null> => {
  try {
    if (navigator.storage && 'estimate' in navigator.storage) {
      const est = await navigator.storage.estimate();
      const usedBytes = est.usage ?? 0;
      const quotaBytes = est.quota ?? 100 * 1024 * 1024;
      const usagePercent = Math.min(
        100,
        Math.round((usedBytes / Math.max(1, quotaBytes)) * 100)
      );
      return { usedBytes, quotaBytes, usagePercent };
    }
  } catch {
    // ignorar
  }
  return null;
};
