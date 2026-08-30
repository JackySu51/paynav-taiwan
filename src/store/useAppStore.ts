import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BarcodeFormat,
  NearestStoreMatch,
  InstalledPack,
  PackIndex,
  PackTaskState,
  PoiPack,
  UsageMap,
  WalletBackup,
  CarrierItem,
  CarrierKind,
  CreditCard,
  CardMeta,
  AnnualEarned,
  RegionCode,
  LocateStatus,
  PaymentMethodMeta,
  RulesDataset,
  StorePOI,
  StoresDataset,
} from '../types';
import {
  DEFAULT_MATCH_RADIUS_M,
  GENERAL_STORE,
  findNearestStoreWithDistance,
  getNearbyStores,
  requestPosition,
} from '../utils/geo';
import { loadDataFile } from '../utils/dataSource';
import { createCarrier } from '../utils/carriers';
import { currentMonth } from '../utils/rewardEngine';
import {
  deletePack,
  estimateUsageKb,
  readAllStores,
  savePack,
} from '../utils/packStore';

interface PersistedState {
  /** 使用者持有的卡片 id */
  ownedCardIds: string[];
  /** 手動輸入的條碼清單（手機條碼、捐贈碼、會員條碼…） */
  carriers: CarrierItem[];
  /** 目前置頂顯示的條碼 id */
  activeCarrierId: string | null;
  /** 使用者手動指定的通路（優先於 GPS） */
  manualStoreId: string | null;
  /** 是否看過首次引導 */
  onboarded: boolean;
  /** 本月各卡片×支付方式已拿到的回饋金額，用來判斷上限還剩多少 */
  usage: UsageMap;
  /** 記帳時預設的消費金額，記住上次輸入的省一次打字 */
  lastAmount: number;
  /** 使用者自己新增的卡片，存在這台裝置 */
  customCards: CreditCard[];
  /** 每張卡的個人備註、年費資訊——跟卡片本身資料分開存，是使用者自己填的 */
  cardMeta: Record<string, CardMeta>;
  /** 每張卡今年累積賺到的回饋，用來跟年費比較（拿現有記帳資料算，不是另一套追蹤） */
  annualEarned: Record<string, AnnualEarned>;
  /** 已下載到這台裝置的地標包（只存中介資料，門市本體在 IndexedDB） */
  installedPacks: InstalledPack[];
  /** 自動更新地標包：未來的付費解鎖功能 */
  autoUpdatePacks: boolean;
  /** 付費功能是否已解鎖（目前恆為 false，等接金流再開） */
  premiumUnlocked: boolean;
}

interface RuntimeState {
  cards: CreditCard[];
  paymentMethods: PaymentMethodMeta[];
  stores: StorePOI[];
  channels: StorePOI[];
  dataVersion: string;
  disclaimer: string;
  /** 這次資料是從線上 CDN 還是內建檔案讀到的 */
  dataSource: 'remote' | 'local' | null;
  matchRadius: number;
  datasetReady: boolean;
  datasetError: string | null;

  coords: { lat: number; lon: number } | null;
  /** 定位精確度（公尺），用於診斷 */
  coordsAccuracy: number | null;
  /** 最後一次定位成功的時間 */
  locatedAt: string | null;
  locateStatus: LocateStatus;
  locateMessage: string;
  detectedStore: StorePOI | null;
  detectedDistance: number | null;

  /** 定位成功後，附近 800 公尺內的門市（給「不是這間？」用） */
  nearbyStores: NearestStoreMatch[];
  /** 內建的基本門市（stores.json），地標包會疊加在上面 */
  baseStores: StorePOI[];
  /** 線上可下載的地標包目錄 */
  packCatalog: PoiPack[];
  packAttribution: string;
  packTask: { id: string | null; state: PackTaskState; message: string };
  /** IndexedDB 實際佔用空間（KB），null 表示瀏覽器不支援估算 */
  storageUsedKb: number | null;
}

interface Actions {
  loadDatasets: () => Promise<void>;
  locate: () => Promise<void>;
  setManualStore: (storeId: string | null) => void;
  toggleCard: (cardId: string) => void;
  setOwnedCards: (ids: string[]) => void;
  /** 新增一組條碼；回傳新增的 id */
  addCarrier: (kind: CarrierKind, value: string, label?: string) => string;
  updateCarrier: (id: string, patch: Partial<Omit<CarrierItem, 'id'>>) => void;
  removeCarrier: (id: string) => void;
  setActiveCarrier: (id: string | null) => void;
  completeOnboarding: () => void;
  resetAll: () => void;
  /** 新增一張自訂卡；回傳卡片 id，並自動勾選為持有 */
  /** 記一筆消費，累計本月已拿到的回饋 */
  logSpend: (usageKey: string, earned: number) => void;
  setCardMeta: (cardId: string, patch: Partial<CardMeta>) => void;
  /** 手動修正某一筆的已用額度 */
  setUsage: (usageKey: string, earned: number) => void;
  /** 清掉本月所有記錄 */
  clearUsage: () => void;
  setLastAmount: (amount: number) => void;
  addCustomCard: (card: Omit<CreditCard, 'id' | 'custom'>) => string;
  updateCustomCard: (cardId: string, card: Omit<CreditCard, 'id' | 'custom'>) => void;
  removeCustomCard: (cardId: string) => void;
  /** 規則庫的卡片 + 使用者自訂的卡片 */
  allCards: () => CreditCard[];
  /** 匯出皮夾設定成一段文字 */
  exportWallet: () => string;
  /** 匯入皮夾設定；回傳錯誤訊息，成功回傳 null */
  importWallet: (payload: string) => string | null;
  loadPackCatalog: () => Promise<void>;
  installPack: (packId: string) => Promise<void>;
  removePack: (packId: string) => Promise<void>;
  setAutoUpdatePacks: (enabled: boolean) => void;
  /** 重新把已安裝的包讀進記憶體，並更新可用空間 */
  refreshPackStores: () => Promise<void>;
  /** 目前生效的通路（手動優先，其次 GPS，最後一般通路） */
  activeStore: () => StorePOI;
  /** 目前置頂的條碼 */
  activeCarrier: () => CarrierItem | null;
  /** 目前所在地區（依生效通路判斷） */
  activeRegion: () => RegionCode;
}

export type AppState = PersistedState & RuntimeState & Actions;

const initialPersisted: PersistedState = {
  ownedCardIds: [],
  carriers: [],
  activeCarrierId: null,
  manualStoreId: null,
  onboarded: false,
  usage: {},
  lastAmount: 300,
  customCards: [],
  cardMeta: {},
  annualEarned: {},
  installedPacks: [],
  autoUpdatePacks: false,
  premiumUnlocked: false,
};

const initialRuntime: RuntimeState = {
  cards: [],
  paymentMethods: [],
  stores: [],
  channels: [],
  dataVersion: '',
  disclaimer: '',
  dataSource: null,
  matchRadius: DEFAULT_MATCH_RADIUS_M,
  datasetReady: false,
  datasetError: null,

  coords: null,
  coordsAccuracy: null,
  locatedAt: null,
  locateStatus: 'idle',
  locateMessage: '',
  detectedStore: null,
  detectedDistance: null,

  nearbyStores: [],
  baseStores: [],
  packCatalog: [],
  packAttribution: '',
  packTask: { id: null, state: 'idle', message: '' },
  storageUsedKb: null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialPersisted,
      ...initialRuntime,

      async loadDatasets() {
        try {
          set({ datasetError: null });
          const [rulesFile, storesFile] = await Promise.all([
            loadDataFile<RulesDataset>('rules.json'),
            loadDataFile<StoresDataset>('stores.json'),
          ]);
          const rules = rulesFile.data;
          const stores = storesFile.data;

          set({
            cards: rules.cards,
            paymentMethods: rules.paymentMethods,
            dataVersion: rules.version,
            disclaimer: rules.disclaimer,
            baseStores: stores.stores,
            stores: stores.stores,
            channels: [
              ...stores.channels.map((c) => ({ ...c, uid: c.id }) as StorePOI),
            ],
            matchRadius: stores.match_radius_meters ?? DEFAULT_MATCH_RADIUS_M,
            dataSource: rulesFile.source,
            datasetReady: true,
          });

          // 目錄與已下載的包各自獨立，任何一邊失敗都不該讓 App 起不來
          void get().loadPackCatalog();
          void get().refreshPackStores();
        } catch (error) {
          set({
            datasetReady: false,
            datasetError:
              error instanceof Error ? error.message : '規則庫載入失敗，請重新整理再試一次',
          });
        }
      },

      async locate() {
        set({ locateStatus: 'locating', locateMessage: '正在確認你在哪一間店…' });
        try {
          const position = await requestPosition();
          const { latitude, longitude, accuracy } = position.coords;
          const match = findNearestStoreWithDistance(
            latitude,
            longitude,
            get().stores,
            get().matchRadius,
          );

          set({
            nearbyStores: getNearbyStores(latitude, longitude, get().stores, 8, 800),
            coords: { lat: latitude, lon: longitude },
            coordsAccuracy: typeof accuracy === 'number' ? Math.round(accuracy) : null,
            locatedAt: new Date().toISOString(),
            locateStatus: 'success',
            detectedStore: match?.store ?? null,
            detectedDistance: match?.distanceMeters ?? null,
            locateMessage: match
              ? ''
              : `附近 ${get().matchRadius} 公尺內沒有收錄的門市，先以一般通路計算`,
            // 定位成功就交還控制權給 GPS
            manualStoreId: null,
          });
        } catch (error) {
          // 舊版 Safari 不一定暴露 GeolocationPositionError，直接讀 code（1 = 權限被拒）
          const denied =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code: number }).code === 1;

          set({
            locateStatus: denied ? 'denied' : 'error',
            locateMessage: denied
              ? '定位權限被關閉了。到系統設定開啟後再試，或直接手動選擇通路。'
              : '這次定位沒有成功，請手動選擇通路。',
          });
        }
      },

      setManualStore(storeId) {
        set({ manualStoreId: storeId, locateMessage: '' });
      },

      toggleCard(cardId) {
        const owned = get().ownedCardIds;
        set({
          ownedCardIds: owned.includes(cardId)
            ? owned.filter((id) => id !== cardId)
            : [...owned, cardId],
        });
      },

      setOwnedCards(ids) {
        set({ ownedCardIds: ids });
      },

      addCarrier(kind, value, label) {
        const item = createCarrier(kind, value, label);
        const carriers = [...get().carriers, item];
        set({ carriers, activeCarrierId: get().activeCarrierId ?? item.id });
        return item.id;
      },

      updateCarrier(id, patch) {
        set({
          carriers: get().carriers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        });
      },

      removeCarrier(id) {
        const carriers = get().carriers.filter((c) => c.id !== id);
        const activeCarrierId =
          get().activeCarrierId === id ? (carriers[0]?.id ?? null) : get().activeCarrierId;
        set({ carriers, activeCarrierId });
      },

      setActiveCarrier(id) {
        set({ activeCarrierId: id });
      },

      completeOnboarding() {
        set({ onboarded: true });
      },

      resetAll() {
        set({ ...initialPersisted, detectedStore: null, detectedDistance: null });
      },

      logSpend(usageKey, earned) {
        const month = currentMonth();
        const prev = get().usage[usageKey];
        // 跨月自動歸零：不用叫使用者自己清，也不用背景任務
        const previousEarned = prev?.month === month ? prev.earned : 0;
        set({
          usage: {
            ...get().usage,
            [usageKey]: {
              month,
              earned: Math.round((previousEarned + earned) * 100) / 100,
              updatedAt: new Date().toISOString(),
            },
          },
        });

        // 順手累積這張卡「今年」賺了多少，給年費淨值判斷用。
        // usageKey 是 `${cardId}|${method}`，同一張卡不同支付方式都要併進同一個總額。
        const cardId = usageKey.split('|')[0];
        const year = new Date().getFullYear();
        const prevAnnual = get().annualEarned[cardId];
        const previousTotal = prevAnnual?.year === year ? prevAnnual.total : 0;
        set({
          annualEarned: {
            ...get().annualEarned,
            [cardId]: {
              year,
              total: Math.round((previousTotal + earned) * 100) / 100,
            },
          },
        });
      },

      setCardMeta(cardId, patch) {
        set({
          cardMeta: {
            ...get().cardMeta,
            [cardId]: { ...get().cardMeta[cardId], ...patch },
          },
        });
      },

      setUsage(usageKey, earned) {
        set({
          usage: {
            ...get().usage,
            [usageKey]: {
              month: currentMonth(),
              earned: Math.max(0, Math.round(earned * 100) / 100),
              updatedAt: new Date().toISOString(),
            },
          },
        });
      },

      clearUsage() {
        set({ usage: {} });
      },

      setLastAmount(amount) {
        set({ lastAmount: Math.max(0, Math.round(amount)) });
      },

      addCustomCard(card) {
        const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const next: CreditCard = { ...card, id, custom: true };
        set({
          customCards: [...get().customCards, next],
          // 自己輸入的卡當然是自己有的，直接勾選省一個步驟
          ownedCardIds: [...get().ownedCardIds, id],
        });
        return id;
      },

      updateCustomCard(cardId, card) {
        set({
          customCards: get().customCards.map((c) =>
            c.id === cardId ? { ...card, id: cardId, custom: true } : c,
          ),
        });
      },

      removeCustomCard(cardId) {
        set({
          customCards: get().customCards.filter((c) => c.id !== cardId),
          ownedCardIds: get().ownedCardIds.filter((id) => id !== cardId),
        });
      },

      allCards() {
        return [...get().cards, ...get().customCards];
      },

      exportWallet() {
        const backup: WalletBackup = {
          v: 1,
          exportedAt: new Date().toISOString(),
          ownedCardIds: get().ownedCardIds,
          customCards: get().customCards,
          carriers: get().carriers,
          usage: get().usage,
          cardMeta: get().cardMeta,
          annualEarned: get().annualEarned,
        };
        // base64 之前先轉 UTF-8，不然中文卡名會炸掉
        const json = JSON.stringify(backup);
        const bytes = new TextEncoder().encode(json);
        let binary = '';
        bytes.forEach((b) => {
          binary += String.fromCharCode(b);
        });
        return `PAYNAV1:${btoa(binary)}`;
      },

      importWallet(payload) {
        try {
          const trimmed = payload.trim();
          if (!trimmed.startsWith('PAYNAV1:')) {
            return '這段文字看起來不是皮夾備份碼（應該以 PAYNAV1: 開頭）';
          }
          const binary = atob(trimmed.slice('PAYNAV1:'.length));
          const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
          const backup = JSON.parse(new TextDecoder().decode(bytes)) as WalletBackup;

          if (backup.v !== 1 || !Array.isArray(backup.ownedCardIds)) {
            return '備份碼的格式不對，可能是複製時漏字了';
          }

          set({
            ownedCardIds: backup.ownedCardIds,
            customCards: Array.isArray(backup.customCards) ? backup.customCards : [],
            carriers: Array.isArray(backup.carriers) ? backup.carriers : get().carriers,
            activeCarrierId: backup.carriers?.[0]?.id ?? get().activeCarrierId,
            usage: backup.usage && typeof backup.usage === 'object' ? backup.usage : get().usage,
            cardMeta:
              backup.cardMeta && typeof backup.cardMeta === 'object'
                ? backup.cardMeta
                : get().cardMeta,
            annualEarned:
              backup.annualEarned && typeof backup.annualEarned === 'object'
                ? backup.annualEarned
                : get().annualEarned,
          });
          return null;
        } catch {
          return '解讀失敗，請確認整段文字都複製到了';
        }
      },

      async loadPackCatalog() {
        try {
          const { data } = await loadDataFile<PackIndex>('packs/index.json');
          const installed = get().installedPacks;
          const catalog = data.packs.map((pack) => ({ ...pack }));

          // 標記哪些已安裝的包有新版本
          const nextInstalled = installed.map((item) => {
            const remote = catalog.find((p) => p.id === item.id);
            return {
              ...item,
              updateAvailable: Boolean(
                remote?.status === 'ready' && remote.version && remote.version !== item.version,
              ),
            };
          });

          set({
            packCatalog: catalog,
            packAttribution: data.attribution ?? '',
            installedPacks: nextInstalled,
          });
        } catch {
          // 沒有目錄檔也能用內建門市，靜靜失敗就好
          set({ packCatalog: [], packAttribution: '' });
        }
      },

      async installPack(packId) {
        const pack = get().packCatalog.find((p) => p.id === packId);
        if (!pack) return;
        if (pack.status !== 'ready') {
          set({
            packTask: {
              id: packId,
              state: 'error',
              message: '這個地區包還沒產製。在專案裡跑 npm run packs:build 之後重新部署即可。',
            },
          });
          return;
        }

        set({ packTask: { id: packId, state: 'downloading', message: '下載中…' } });
        try {
          const { data } = await loadDataFile<{
            id: string;
            version: string;
            stores: StorePOI[];
          }>(`packs/${packId}.json`, { timeoutMs: 60_000 });

          if (!Array.isArray(data.stores) || data.stores.length === 0) {
            throw new Error('這個包裡面沒有門市資料');
          }

          await savePack(packId, data.version || pack.version, data.stores);

          const others = get().installedPacks.filter((p) => p.id !== packId);
          set({
            installedPacks: [
              ...others,
              {
                id: packId,
                version: data.version || pack.version,
                storeCount: data.stores.length,
                sizeKb: pack.sizeKb,
                installedAt: new Date().toISOString(),
                updateAvailable: false,
              },
            ],
            packTask: { id: null, state: 'idle', message: '' },
          });
          await get().refreshPackStores();
        } catch (error) {
          set({
            packTask: {
              id: packId,
              state: 'error',
              message: error instanceof Error ? error.message : '下載失敗，請稍後再試',
            },
          });
        }
      },

      async removePack(packId) {
        try {
          await deletePack(packId);
        } catch {
          // 刪不掉也要把中介資料清掉，不然畫面會一直顯示已安裝
        }
        set({ installedPacks: get().installedPacks.filter((p) => p.id !== packId) });
        await get().refreshPackStores();
      },

      setAutoUpdatePacks(enabled) {
        // 付費功能還沒開通，這裡先擋住，避免使用者以為已經生效
        if (enabled && !get().premiumUnlocked) return;
        set({ autoUpdatePacks: enabled });
      },

      async refreshPackStores() {
        const ids = get().installedPacks.map((p) => p.id);
        const packStores = await readAllStores(ids);
        const base = get().baseStores;

        /**
         * 地標包優先。
         *
         * 有一件事要處理：stores.json 裡的內建門市是示範點位（例如「7-ELEVEN 台北市府門市」），
         * 一旦使用者下載了真實地標包，同一間店會出現兩筆（示範的 + OSM 的），
         * 座標又差幾十公尺，「最近門市」就可能指到示範資料上。
         * 所以某個地區只要裝了包，就把該地區的內建示範點位讓位給真實資料。
         */
        const coveredRegions = new Set(
          get()
            .installedPacks.map((p) => get().packCatalog.find((c) => c.id === p.id)?.region)
            .filter((r): r is RegionCode => Boolean(r)),
        );
        const seen = new Set(packStores.map((s) => s.uid));
        const merged = [
          ...packStores,
          ...base.filter(
            (s) => !seen.has(s.uid) && !coveredRegions.has(s.region ?? 'TW'),
          ),
        ];

        set({ stores: merged, storageUsedKb: await estimateUsageKb() });

        // 門市清單變了，重新比對一次目前位置
        const coords = get().coords;
        if (coords) {
          const match = findNearestStoreWithDistance(
            coords.lat,
            coords.lon,
            merged,
            get().matchRadius,
          );
          set({
            detectedStore: match?.store ?? null,
            detectedDistance: match?.distanceMeters ?? null,
            nearbyStores: getNearbyStores(coords.lat, coords.lon, merged, 8, 800),
          });
        }
      },

      activeCarrier() {
        const { carriers, activeCarrierId } = get();
        if (carriers.length === 0) return null;
        return carriers.find((c) => c.id === activeCarrierId) ?? carriers[0];
      },

      activeRegion() {
        return get().activeStore().region ?? 'TW';
      },

      activeStore() {
        const { manualStoreId, channels, stores, detectedStore } = get();
        if (manualStoreId) {
          const fromChannels = channels.find((c) => c.id === manualStoreId);
          const fromStores = stores.find((s) => s.id === manualStoreId);
          return fromChannels ?? fromStores ?? GENERAL_STORE;
        }
        return detectedStore ?? GENERAL_STORE;
      },
    }),
    {
      name: 'paynav-taiwan-v1',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({
        ownedCardIds: state.ownedCardIds,
        carriers: state.carriers,
        activeCarrierId: state.activeCarrierId,
        manualStoreId: state.manualStoreId,
        onboarded: state.onboarded,
        usage: state.usage,
        lastAmount: state.lastAmount,
        customCards: state.customCards,
        cardMeta: state.cardMeta,
        annualEarned: state.annualEarned,
        installedPacks: state.installedPacks,
        autoUpdatePacks: state.autoUpdatePacks,
        premiumUnlocked: state.premiumUnlocked,
      }),
      /**
       * 舊版只存一組手機條碼字串。升級時自動搬成清單，
       * 使用者不會發現自己的條碼「不見了」——這種事一次就會流失一個人。
       */
      migrate: (persisted, fromVersion) => {
        const state = (persisted ?? {}) as Partial<PersistedState> & {
          carrierBarcode?: string;
          barcodeFormat?: BarcodeFormat;
        };
        if (fromVersion < 2 && state.carrierBarcode && !state.carriers?.length) {
          const migrated = createCarrier('mobile', state.carrierBarcode, '手機條碼');
          return {
            ...state,
            carriers: [migrated],
            activeCarrierId: migrated.id,
          } as PersistedState;
        }
        return {
          usage: {},
          lastAmount: 300,
          customCards: [],
          cardMeta: {},
          annualEarned: {},
          installedPacks: [],
          autoUpdatePacks: false,
          premiumUnlocked: false,
          ...state,
        } as PersistedState;
      },
    },
  ),
);
