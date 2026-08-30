import type { StorePOI } from '../types';

/**
 * 地標包的本機儲存。
 *
 * 為什麼用 IndexedDB 而不是 localStorage：
 * localStorage 通常只有 5MB，而且是同步的——寫入時會卡住畫面。
 * 一個縣市的門市資料動輒數百 KB，多裝幾個地區就會爆掉。
 * IndexedDB 沒有這個問題，而且是非同步的，下載大包時畫面不會凍住。
 *
 * 這裡只用最原始的 IndexedDB API，不裝任何套件——這種程度的需求
 * 沒必要為它增加一個依賴。
 */

const DB_NAME = 'paynav-packs';
const DB_VERSION = 1;
const STORE = 'packs';

interface StoredPack {
  id: string;
  version: string;
  stores: StorePOI[];
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('這個瀏覽器不支援 IndexedDB，無法儲存地標包'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 開啟失敗'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失敗'));
        transaction.oncomplete = () => db.close();
      }),
  );
}

export async function savePack(id: string, version: string, stores: StorePOI[]): Promise<void> {
  const payload: StoredPack = { id, version, stores, savedAt: new Date().toISOString() };
  await tx<IDBValidKey>('readwrite', (s) => s.put(payload));
}

export async function readPack(id: string): Promise<StoredPack | null> {
  const result = await tx<StoredPack | undefined>('readonly', (s) => s.get(id));
  return result ?? null;
}

export async function deletePack(id: string): Promise<void> {
  await tx<undefined>('readwrite', (s) => s.delete(id));
}

/** 把所有已安裝的包攤平成一個門市陣列，給定位比對用 */
export async function readAllStores(ids: string[]): Promise<StorePOI[]> {
  const all: StorePOI[] = [];
  for (const id of ids) {
    try {
      const pack = await readPack(id);
      if (pack?.stores?.length) all.push(...pack.stores);
    } catch {
      // 單一包讀不到就跳過，不要讓整個 App 起不來
    }
  }
  return all;
}

/** 估算已用掉的空間（KB）；瀏覽器不支援時回傳 null */
export async function estimateUsageKb(): Promise<number | null> {
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage?.estimate) return null;
  try {
    const { usage } = await storage.estimate();
    return typeof usage === 'number' ? Math.round(usage / 1024) : null;
  } catch {
    return null;
  }
}

/** 清掉所有地標包 */
export async function clearAllPacks(): Promise<void> {
  await tx<undefined>('readwrite', (s) => s.clear());
}
