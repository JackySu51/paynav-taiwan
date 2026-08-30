import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LocateFixed, MapPin, Search, TriangleAlert, X } from 'lucide-react';
import type { LocateStatus, NearestStoreMatch, RegionCode, StorePOI } from '../types';
import { formatDistance } from '../utils/geo';

interface StoreDetectorProps {
  activeStore: StorePOI;
  detectedDistance: number | null;
  locateStatus: LocateStatus;
  locateMessage: string;
  channels: StorePOI[];
  isManual: boolean;
  /** 附近 800 公尺內的門市，讓使用者一鍵修正「不是這間」 */
  nearbyStores: NearestStoreMatch[];
  onLocate: () => void;
  onSelectChannel: (storeId: string | null) => void;
}

const REGION_LABEL: Record<RegionCode, string> = {
  TW: '台灣',
  JP: '日本',
  KR: '韓國',
};

const REGION_FLAG: Record<RegionCode, string> = {
  TW: '🇹🇼',
  JP: '🇯🇵',
  KR: '🇰🇷',
};

const REGION_ORDER: RegionCode[] = ['TW', 'JP', 'KR'];

const CATEGORY_LABEL: Record<StorePOI['category'], string> = {
  convenience: '便利商店',
  supermarket: '超市',
  hypermarket: '量販',
  coffee: '咖啡',
  beverage: '手搖飲',
  fastfood: '速食',
  restaurant: '餐廳',
  bakery: '烘焙',
  drugstore: '藥妝藥局',
  department: '百貨',
  electronics: '3C 家電',
  homeware: '居家生活',
  bookstore: '書店文具',
  entertainment: '娛樂',
  transport: '交通',
  fuel: '加油站',
  delivery: '外送',
  ecommerce: '網購',
  general: '其他通路',
};

const CATEGORY_ORDER: Array<StorePOI['category']> = [
  'convenience',
  'supermarket',
  'hypermarket',
  'coffee',
  'beverage',
  'fastfood',
  'restaurant',
  'bakery',
  'drugstore',
  'department',
  'electronics',
  'homeware',
  'bookstore',
  'entertainment',
  'transport',
  'fuel',
  'delivery',
  'ecommerce',
  'general',
];

export default function StoreDetector({
  activeStore,
  detectedDistance,
  locateStatus,
  locateMessage,
  channels,
  isManual,
  nearbyStores,
  onLocate,
  onSelectChannel,
}: StoreDetectorProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const locating = locateStatus === 'locating';
  const activeRegion: RegionCode = activeStore.region ?? 'TW';
  const [regionFilter, setRegionFilter] = useState<RegionCode>(activeRegion);

  // 通路換地區時，下拉選單也跟著跳到那一區，不用使用者自己找
  useEffect(() => {
    setRegionFilter(activeRegion);
  }, [activeRegion]);

  const availableRegions = REGION_ORDER.filter((r) =>
    channels.some((c) => (c.region ?? 'TW') === r),
  );

  const kw = keyword.trim().toLowerCase();
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: channels.filter(
      (c) =>
        c.category === category &&
        (c.region ?? 'TW') === regionFilter &&
        (kw === '' || c.name.toLowerCase().includes(kw) || c.id.includes(kw)),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div ref={panelRef} className="relative">
      <div className="flex items-stretch gap-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="tap block flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:bg-[var(--surface-2)]"
        >
          <MapPin
            size={19}
            aria-hidden
            className={isManual ? 'text-[var(--text-dim)]' : 'text-[var(--success)]'}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-semibold leading-tight">
              {activeRegion !== 'TW' ? `${REGION_FLAG[activeRegion]} ` : ''}
              {activeStore.name}
              {activeStore.branch ? (
                <span className="ml-1.5 text-[13px] font-normal text-dim">
                  {activeStore.branch}
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-[11.5px] text-faint">
              {isManual
                ? '手動選擇的通路'
                : detectedDistance !== null
                  ? `定位命中．距離 ${formatDistance(detectedDistance)}`
                  : locateStatus === 'success'
                    ? '附近沒有收錄門市，先算一般通路'
                    : '點一下切換通路'}
            </span>
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className={`shrink-0 text-[var(--text-faint)] transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          aria-label="重新定位"
          className="tap block flex w-[52px] shrink-0 items-center justify-center rounded-2xl active:bg-[var(--surface-2)] disabled:opacity-60"
        >
          <LocateFixed
            size={20}
            aria-hidden
            className={`text-[var(--accent)] ${locating ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {locateMessage ? (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-dim">
          <TriangleAlert size={14} className="mt-px shrink-0 text-[var(--accent)]" aria-hidden />
          {locateMessage}
        </p>
      ) : null}

      {open ? (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[58vh] animate-riseIn overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 ">
          <button
            type="button"
            onClick={() => {
              onSelectChannel(null);
              setOpen(false);
              onLocate();
            }}
            className="tap mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium active:bg-[var(--surface-2)]"
          >
            <LocateFixed size={16} className="text-[var(--accent)]" aria-hidden />
            交還給定位自動判斷
          </button>

          {nearbyStores.length > 0 && !keyword ? (
            <div className="mb-2">
              <div className="px-3 pb-1 pt-1 text-[11px] font-medium tracking-wide text-faint">
                附近的門市
              </div>
              {nearbyStores.slice(0, 5).map((match) => (
                <button
                  key={match.store.uid ?? `${match.store.id}-${match.distanceMeters}`}
                  type="button"
                  onClick={() => {
                    onSelectChannel(match.store.id);
                    setOpen(false);
                  }}
                  className="tap flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left active:bg-[var(--surface-2)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px]">{match.store.name}</span>
                    {match.store.branch ? (
                      <span className="block truncate text-[11.5px] text-faint">
                        {match.store.branch}
                      </span>
                    ) : null}
                  </span>
                  <span className="num shrink-0 text-[11.5px] text-dim">
                    {formatDistance(match.distanceMeters)}
                  </span>
                </button>
              ))}
              <div className="my-1.5 border-t border-[var(--line)]" />
            </div>
          ) : null}

          <div className="block-inset mb-1.5 flex items-center gap-2 rounded-full px-3 py-2">
            <Search size={15} className="shrink-0 text-[var(--text-faint)]" aria-hidden />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜尋通路，例如 全聯、蝦皮、捷運"
              aria-label="搜尋通路"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--text-faint)]"
            />
            {keyword ? (
              <button
                type="button"
                onClick={() => setKeyword('')}
                aria-label="清除搜尋"
                className="tap text-[var(--text-faint)]"
              >
                <X size={14} aria-hidden />
              </button>
            ) : null}
          </div>

          {availableRegions.length > 1 ? (
            <div className="mb-1 flex gap-1.5 px-1 pb-1">
              {availableRegions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegionFilter(r)}
                  className={`tap flex-1 rounded-full border py-1.5 text-[12.5px] ${
                    r === regionFilter
                      ? 'border-[var(--accent)] bg-[var(--surface-2)] font-medium'
                      : 'border-[var(--line)] text-dim'
                  }`}
                >
                  {REGION_FLAG[r]} {REGION_LABEL[r]}
                </button>
              ))}
            </div>
          ) : null}

          {grouped.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-dim">
              沒有符合「{keyword}」的通路。換個關鍵字，或選「其他通路」用全通路規則計算。
            </p>
          ) : null}

          {grouped.map((group) => (
            <div key={group.category} className="mb-1">
              <div className="px-3 pb-1 pt-2 text-[11px] font-medium tracking-wide text-faint">
                {CATEGORY_LABEL[group.category]}
              </div>
              {group.items.map((channel) => {
                const selected = channel.id === activeStore.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => {
                      onSelectChannel(channel.id);
                      setOpen(false);
                    }}
                    className="tap flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left active:bg-[var(--surface-2)]"
                  >
                    <span className="text-[15px]">{channel.name}</span>
                    {selected ? (
                      <Check size={16} className="text-[var(--accent)]" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
