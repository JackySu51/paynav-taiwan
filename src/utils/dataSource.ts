/**
 * 資料來源切換器。
 *
 * 優先順序：
 *   1. VITE_DATA_BASE_URL（Cloudflare R2 / CDN 上的最新資料）
 *   2. 專案內建的 public/data/（離線與第一次開啟時的保底）
 *
 * 兩邊都失敗才丟錯。這樣「更新回饋規則」不用重新部署整個網站，
 * 只要把新的 JSON 丟上 R2 就好。
 */

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const REMOTE_DATA_BASE = trimSlash(import.meta.env.VITE_DATA_BASE_URL ?? '');
export const LOCAL_DATA_BASE = `${import.meta.env.BASE_URL}data`;

export interface LoadedData<T> {
  data: T;
  source: 'remote' | 'local';
  url: string;
}

async function fetchJson<T>(url: string, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface LoadOptions {
  /**
   * 逾時毫秒數。規則庫很小，6 秒夠了；
   * 地標包可能接近 1MB，在行動網路下要給更多時間，否則會被自己的逾時砍掉。
   */
  timeoutMs?: number;
}

/**
 * 讀取一份資料檔，例如 loadDataFile('rules.json')、loadDataFile('packs/tw-taipei.json')
 */
export async function loadDataFile<T>(
  fileName: string,
  options: LoadOptions = {},
): Promise<LoadedData<T>> {
  const timeoutMs = options.timeoutMs ?? 6000;

  if (REMOTE_DATA_BASE) {
    const remoteUrl = `${REMOTE_DATA_BASE}/${fileName}`;
    try {
      return { data: await fetchJson<T>(remoteUrl, timeoutMs), source: 'remote', url: remoteUrl };
    } catch {
      // 線上抓不到很正常（離線、R2 還沒建好），安靜退回內建資料
    }
  }

  const localUrl = `${LOCAL_DATA_BASE}/${fileName}`;
  return { data: await fetchJson<T>(localUrl, timeoutMs), source: 'local', url: localUrl };
}
