import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Crosshair,
  Download,
  HardDrive,
  Lock,
  MapPin,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  InstalledPack,
  LocateStatus,
  PackTaskState,
  PoiPack,
  RegionCode,
} from '../types';

interface LocateDiagnostics {
  status: LocateStatus;
  coords: { lat: number; lon: number } | null;
  accuracy: number | null;
  locatedAt: string | null;
  nearestName: string | null;
  nearestDistance: number | null;
  matchRadius: number;
  loadedStores: number;
  onLocate: () => void;
}

interface PackManagerProps {
  catalog: PoiPack[];
  installed: InstalledPack[];
  attribution: string;
  task: { id: string | null; state: PackTaskState; message: string };
  storageUsedKb: number | null;
  autoUpdate: boolean;
  premiumUnlocked: boolean;
  onInstall: (packId: string) => void;
  onRemove: (packId: string) => void;
  onToggleAutoUpdate: (enabled: boolean) => void;
  diagnostics: LocateDiagnostics;
}

const REGION_LABEL: Record<RegionCode, string> = { TW: '台灣', JP: '日本', KR: '韓國' };
const REGION_FLAG: Record<RegionCode, string> = { TW: '🇹🇼', JP: '🇯🇵', KR: '🇰🇷' };
const REGION_ORDER: RegionCode[] = ['TW', 'JP', 'KR'];

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export default function PackManager({
  catalog,
  installed,
  attribution,
  task,
  storageUsedKb,
  autoUpdate,
  premiumUnlocked,
  onInstall,
  onRemove,
  onToggleAutoUpdate,
  diagnostics,
}: PackManagerProps) {
  const [region, setRegion] = useState<RegionCode>('TW');

  const installedMap = useMemo(
    () => new Map(installed.map((p) => [p.id, p])),
    [installed],
  );

  const list = useMemo(
    () => catalog.filter((p) => p.region === region),
    [catalog, region],
  );

  const totals = useMemo(() => {
    const count = installed.reduce((sum, p) => sum + p.storeCount, 0);
    const updates = installed.filter((p) => p.updateAvailable).length;
    return { count, updates };
  }, [installed]);

  const availableRegions = REGION_ORDER.filter((r) => catalog.some((p) => p.region === r));

  if (catalog.length === 0) {
    return (
      <section className="block rounded-2xl px-5 py-9 text-center">
        <MapPin size={24} className="mx-auto text-[var(--text-faint)]" aria-hidden />
        <p className="mt-3 text-[15px] font-medium">讀不到地標包目錄</p>
        <p className="mx-auto mt-1.5 max-w-[18rem] text-[13px] leading-relaxed text-dim">
          目前使用內建的基本門市資料，定位還是可以運作。
          確認 <span className="num">public/data/packs/index.json</span> 存在後重新整理。
        </p>
      </section>
    );
  }

  const d = diagnostics;
  const statusText: Record<LocateStatus, string> = {
    idle: '尚未定位',
    locating: '正在定位…',
    success: '定位成功',
    denied: '定位權限被拒絕',
    error: '定位失敗',
  };

  return (
    <div className="space-y-4">
      {/* GPS 診斷：讓你一眼看出定位到底有沒有在動 */}
      <section className="block rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crosshair size={16} className="text-[var(--accent)]" aria-hidden />
            <h2 className="text-[15px] font-semibold">定位狀態</h2>
          </div>
          <button
            type="button"
            onClick={d.onLocate}
            disabled={d.status === 'locating'}
            className="tap flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[12.5px] font-medium disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={d.status === 'locating' ? 'animate-spin' : ''}
              aria-hidden
            />
            測試定位
          </button>
        </div>

        <dl className="num mt-3 space-y-1.5 text-[12px]">
          <div className="flex justify-between gap-3">
            <dt className="text-faint">狀態</dt>
            <dd
              className={
                d.status === 'success'
                  ? 'text-[var(--success)]'
                  : d.status === 'denied' || d.status === 'error'
                    ? 'text-[var(--danger)]'
                    : 'text-dim'
              }
            >
              {statusText[d.status]}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-faint">座標</dt>
            <dd className="text-dim">
              {d.coords ? `${d.coords.lat.toFixed(5)}, ${d.coords.lon.toFixed(5)}` : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-faint">精確度</dt>
            <dd className="text-dim">{d.accuracy !== null ? `± ${d.accuracy} 公尺` : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-faint">最近門市</dt>
            <dd className="text-dim">
              {d.nearestName
                ? `${d.nearestName}（${Math.round(d.nearestDistance ?? 0)} 公尺）`
                : d.status === 'success'
                  ? `${d.matchRadius} 公尺內沒有收錄的門市`
                  : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-faint">目前載入門市</dt>
            <dd className="text-dim">{d.loadedStores.toLocaleString('zh-TW')} 間</dd>
          </div>
        </dl>

        {d.status === 'denied' ? (
          <p className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[12px] leading-relaxed text-dim">
            瀏覽器或系統擋掉了定位。Mac 上到「系統設定 → 隱私權與安全性 → 定位服務」確認瀏覽器有打勾；
            iPhone 則在「設定 → 隱私權與安全性 → 定位服務 → Safari 網站」選「使用 App 期間」。
          </p>
        ) : null}

        {d.status === 'success' && !d.nearestName ? (
          <p className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[12px] leading-relaxed text-dim">
            定位本身是正常的——只是這附近還沒有收錄門市。下載你所在地區的地標包就會開始自動判斷。
          </p>
        ) : null}
      </section>

      {/* 已用空間 */}
      <section className="block rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className="text-[var(--accent)]" aria-hidden />
          <h2 className="text-[15px] font-semibold">已下載的地標</h2>
        </div>
        <div className="mt-3 flex items-end gap-4">
          <div>
            <div className="num text-[26px] font-bold leading-none">
              {totals.count.toLocaleString('zh-TW')}
            </div>
            <div className="mt-1 text-[11px] text-faint">間門市</div>
          </div>
          <div>
            <div className="num text-[26px] font-bold leading-none">{installed.length}</div>
            <div className="mt-1 text-[11px] text-faint">個地區</div>
          </div>
          {storageUsedKb !== null ? (
            <div>
              <div className="num text-[26px] font-bold leading-none">
                {formatSize(storageUsedKb)}
              </div>
              <div className="mt-1 text-[11px] text-faint">佔用空間</div>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-dim">
          只下載你會去的地區，App 就不會佔太多空間。刪掉之後隨時可以再抓回來。
          {totals.updates > 0 ? (
            <span className="text-[var(--accent)]">
              {' '}
              有 {totals.updates} 個地區有新版本。
            </span>
          ) : null}
        </p>
      </section>

      {/* 自動更新（付費解鎖） */}
      <section
        className={`rounded-2xl border p-4 ${
          premiumUnlocked ? 'border-[var(--line)] bg-[var(--surface)]' : 'border-[var(--accent)] bg-[var(--surface)]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {!premiumUnlocked ? (
                <Lock size={13} className="text-[var(--accent)]" aria-hidden />
              ) : null}
              <h3 className="text-[14px] font-semibold">自動更新地標</h3>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-dim">
              {premiumUnlocked
                ? '連上 Wi-Fi 時自動把已下載的地區更新到最新版本。'
                : '門市會開會關，自動更新會在有 Wi-Fi 時幫你補上。這項功能規劃為付費解鎖，目前尚未開放。'}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={autoUpdate}
            aria-label="自動更新地標"
            disabled={!premiumUnlocked}
            onClick={() => onToggleAutoUpdate(!autoUpdate)}
            className={`tap relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors ${
              autoUpdate
                ? 'border-[var(--accent)] bg-[var(--accent)]'
                : 'border-[var(--line)] bg-[var(--surface-2)]'
            } ${premiumUnlocked ? '' : 'opacity-45'}`}
          >
            <span
              aria-hidden
              className={`absolute top-[3px] h-[19px] w-[19px] rounded-full bg-white transition-all ${
                autoUpdate ? 'left-[26px]' : 'left-[3px]'
              }`}
            />
          </button>
        </div>
      </section>

      {/* 地區選擇 */}
      <div className="flex gap-1.5">
        {availableRegions.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            className={`tap flex-1 rounded-full border py-2 text-[13px] ${
              r === region
                ? 'border-[var(--accent)] bg-[var(--surface-2)] font-medium'
                : 'border-[var(--line)] text-dim'
            }`}
          >
            {REGION_FLAG[r]} {REGION_LABEL[r]}
          </button>
        ))}
      </div>

      {/* 地區包清單 */}
      <ul className="space-y-2">
        {list.map((pack) => {
          const item = installedMap.get(pack.id);
          const busy = task.id === pack.id && task.state === 'downloading';
          const failed = task.id === pack.id && task.state === 'error';
          const pending = pack.status !== 'ready';

          return (
            <li key={pack.id} className="block rounded-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-medium">{pack.area}</span>
                    {item ? (
                      <Check size={14} className="shrink-0 text-[var(--success)]" aria-hidden />
                    ) : null}
                    {item?.updateAvailable ? (
                      <span className="shrink-0 rounded-full bg-[var(--accent)] px-1.5 py-[2px] text-[10px] font-bold text-[var(--accent-ink)]">
                        有更新
                      </span>
                    ) : null}
                  </div>
                  <p className="num mt-0.5 text-[11.5px] text-faint">
                    {pending
                      ? `尚未產製．估 ${pack.storeCount.toLocaleString('zh-TW')} 間 / ${formatSize(pack.sizeKb)}`
                      : `${(item?.storeCount ?? pack.storeCount).toLocaleString('zh-TW')} 間 / ${formatSize(pack.sizeKb)}${
                          pack.version ? ` / ${pack.version}` : ''
                        }`}
                  </p>
                </div>

                {item ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.updateAvailable ? (
                      <button
                        type="button"
                        onClick={() => onInstall(pack.id)}
                        disabled={busy}
                        aria-label={`更新 ${pack.area}`}
                        className="tap flex h-9 items-center gap-1 rounded-full bg-[var(--accent)] px-3 text-[12.5px] font-semibold text-[var(--accent-ink)] disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={busy ? 'animate-spin' : ''} aria-hidden />
                        更新
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRemove(pack.id)}
                      aria-label={`刪除 ${pack.area}`}
                      className="tap flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text-faint)]"
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onInstall(pack.id)}
                    disabled={busy || pending}
                    className={`tap flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold ${
                      pending
                        ? 'border border-[var(--line)] text-[var(--text-faint)]'
                        : 'bg-[var(--surface-2)] text-[var(--text)]'
                    } disabled:opacity-60`}
                  >
                    <Download size={14} className={busy ? 'animate-pulse' : ''} aria-hidden />
                    {busy ? '下載中' : pending ? '未產製' : '下載'}
                  </button>
                )}
              </div>

              {failed ? (
                <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[12px] leading-snug text-dim">
                  <AlertTriangle
                    size={13}
                    className="mt-px shrink-0 text-[var(--accent)]"
                    aria-hidden
                  />
                  {task.message}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {attribution ? (
        <p className="px-1 text-[11px] leading-relaxed text-faint">{attribution}</p>
      ) : null}
    </div>
  );
}
