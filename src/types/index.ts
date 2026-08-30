/**
 * 台灣支付導航 PayNav Taiwan — 全域型別定義
 * 所有資料皆在瀏覽器端運算，這裡的型別同時是 public/data/*.json 的 schema 契約。
 */

/** 支付方式代號 */
export type PaymentMethodType =
  // 專營電子支付機構（金管會核准）
  | 'jkopay' // 街口支付
  | 'ipass_money' // 一卡通 MONEY
  | 'pxpayplus' // 全支付（全聯）
  | 'easywallet' // 悠遊付
  | 'pxpay_plus' // 全盈+PAY（全家）
  | 'icashpay' // icash Pay（愛金卡）
  | 'opay' // 歐付寶 O'Pay
  | 'gamapay' // 橘子支付 GAMA PAY
  | 'simplepay' // 簡單行動支付
  | 'linepay' // LINE Pay
  // 銀行與共同平台
  | 'taiwanpay' // 台灣 Pay
  | 'twqr' // TWQR 電支跨機構共同平台
  | 'esun_wallet' // 玉山 Wallet
  | 'taishin_pay' // 台新 Pay+
  // 通路自家錢包
  | 'px_pay' // 全聯 PX Pay
  | 'famipay' // My FamiPay
  // 手機感應
  | 'apple_pay' // Apple Pay
  | 'google_pay' // Google Pay
  | 'samsung_pay' // Samsung Wallet
  // 實體卡片
  | 'easycard' // 悠遊卡感應
  | 'ipass_card' // 一卡通感應
  | 'physical'; // 實體刷卡

/** 地區代號：台灣、日本、韓國 */
export type RegionCode = 'TW' | 'JP' | 'KR';

/** 支付方式的顯示與跳轉資訊 */
export interface PaymentMethodMeta {
  id: PaymentMethodType;
  /** 顯示名稱，例如「街口支付」 */
  name: string;
  /** URL Scheme，例如 jkopay://；實體刷卡為空字串 */
  scheme: string;
  /** 代表色（hex） */
  color: string;
  /** 對應 lucide-react 的圖示名稱（kebab-case） */
  iconName: string;
  /** 未安裝 App 時的網頁備援 */
  webFallback?: string;
  /** 未安裝 App 時的商店連結 */
  storeUrl?: string;
  /** 這個支付工具的一句話特色，顯示在皮夾與說明處 */
  note?: string;
  /** 可在哪些海外地區使用（例如街口串接日本 PayPay） */
  overseas?: RegionCode[];
}

/** 通路分類 */
export type StoreCategory =
  | 'convenience' // 便利商店
  | 'supermarket' // 超市
  | 'hypermarket' // 量販
  | 'coffee' // 咖啡
  | 'beverage' // 手搖飲
  | 'fastfood' // 速食
  | 'restaurant' // 餐廳
  | 'bakery' // 烘焙
  | 'drugstore' // 藥妝藥局
  | 'department' // 百貨
  | 'electronics' // 3C 家電
  | 'homeware' // 居家生活
  | 'bookstore' // 書店文具
  | 'entertainment' // 娛樂影城
  | 'transport' // 交通運輸
  | 'fuel' // 加油站
  | 'delivery' // 外送平台
  | 'ecommerce' // 網購
  | 'general'; // 其他通路

/**
 * 門市 / 通路
 * 注意：`id` 是「通路代號」（例如 seven_eleven），會被回饋規則的 channels 比對，
 * 因此同一通路的多間分店會共用同一個 id；請用 `uid` 當作 React key。
 */
export interface StorePOI {
  id: string;
  name: string;
  category: StoreCategory;
  latitude?: number;
  longitude?: number;
  /** 分店名稱，例如「台北市府門市」 */
  branch?: string;
  /** 單筆資料唯一鍵 */
  uid?: string;
  /** 所屬地區，沒寫視為台灣 */
  region?: RegionCode;
}

/** 定位比對結果 */
export interface NearestStoreMatch {
  store: StorePOI;
  /** 使用者與該門市的距離（公尺） */
  distanceMeters: number;
}

/** 單一張卡在某支付方式 × 某通路下的回饋規則 */
export interface CardRewardRule {
  payment_method: PaymentMethodType;
  /** ['all'] 或 ['seven_eleven', 'family_mart'] */
  channels: string[];
  base_reward_pct: number;
  extra_reward_pct: number;
  /** 每月回饋上限（新台幣），null 表示無上限 */
  cap_amount_monthly: number | null;
  note: string;
  /** 是否為值得主打的神卡規則 */
  is_affiliate_highlight?: boolean;
  /** 活動截止日（YYYY-MM-DD）。到期前 30 天 GitHub Actions 會提醒你去核對銀行公告 */
  valid_until?: string;
}

/** 信用卡 */
export interface CreditCard {
  id: string;
  bank: string;
  name: string;
  apply_url?: string;
  rules: CardRewardRule[];
  /** 使用者自己新增的卡片（存在本機，不在規則庫裡） */
  custom?: boolean;
  /**
   * 不需要使用者「持有」就會納入試算。
   * 用在電支帳戶直接扣款這種回饋屬於支付工具本身、不綁任何信用卡的情況
   * （例如悠遊付、icash Pay 在韓國只能用帳戶扣款）。
   */
  always_available?: boolean;
}

/**
 * 使用者自己填的卡片備註跟年費資訊。
 *
 * 刻意跟 CreditCard 分開存：CreditCard 是規則庫裡的共用資料（或使用者
 * 自建的自訂卡片結構），這裡是「我自己對這張卡的筆記」，是個人化資料，
 * 存在本機 localStorage，不會混進規則庫。
 *
 * 年費划不划算的判斷刻意做成「拿現有的記帳資料算淨值」，不是另外做一套
 * 追蹤系統——參考美國 MaxRewards 的做法：今年這張卡賺了多少回饋，
 * 直接跟年費比較，而不是要使用者自己手動勾選「達成門檻了嗎」。
 */
export interface CardMeta {
  /** 自己寫的備註，例如「這張是媽媽的卡」「記得每月 5 號扣款」 */
  note?: string;
  /** 年費金額（新台幣），沒填就不顯示年費相關的任何東西 */
  annualFee?: number;
  /** 免年費條件的文字說明，例如「年刷 6 次或消費滿 3 萬」——用文字描述，不做結構化規則判斷 */
  feeWaiverNote?: string;
  /** 續卡/收年費的月份（1-12），用來提醒「快到期了」 */
  renewalMonth?: number;
}

/** 某張卡今年累積賺到的回饋總額，用來跟年費比較「值不值得留」 */
export interface AnnualEarned {
  year: number;
  total: number;
}

/**
 * 每月回饋上限的使用紀錄。
 * key 是 `卡片id|支付方式`，因為上限是綁在「這張卡的這個支付方式」上。
 */
export interface RewardUsage {
  /** 例如 2026-08 */
  month: string;
  /** 這個月已經拿到的回饋金額（新台幣） */
  earned: number;
  /** 最後一次記帳時間 */
  updatedAt: string;
}

export type UsageMap = Record<string, RewardUsage>;

/** 試算後的單筆推薦結果 */
export interface CalculatedRewardResult {
  paymentMethod: PaymentMethodMeta;
  cardName: string;
  totalRewardPct: number;
  baseRewardPct: number;
  extraRewardPct: number;
  capMonthly: number | null;
  note: string;
  isBest: boolean;
  /** 名次；並列的項目共用同一個名次，不是排序位置 */
  rank: number;
  /** 跟這個結果並列同名次的項目共有幾個（沒有並列就是 1） */
  tiedCount: number;
  /**
   * 扣掉已用上限後、這一筆實際還拿得到的回饋率。
   * 上限用完時只剩基本回饋，排序也以這個值為準。
   */
  effectiveRewardPct: number;
  /**
   * 海外模式下，扣掉國外交易服務費（約 1.5%，走信用卡清算網路才會收）
   * 之後的淨回饋率。台灣本地消費，或這個支付方式本身不會被收海外手續費
   * （帳戶扣款類），這裡是 null——不是「沒有算」，是「這個情境不適用」。
   *
   * 排序跟並列判斷也是以這個值為準（region 不是 TW 的時候），不是隨便顯示
   * 而已——含手續費的實際成本，才是使用者站在收銀台前真正該比較的數字，
   * 原始回饋率沒扣手續費，可能會誤導成「這張卡比較划算」但其實淨損。
   */
  netOverseasRewardPct: number | null;
  /** 這個月這條規則還剩多少回饋額度；null 表示無上限 */
  capRemaining: number | null;
  /** 上限是否已經用完 */
  capExhausted: boolean;
  /** 用於記帳的 key */
  usageKey: string;
  /** 供 UI 追蹤來源卡片 */
  cardId: string;
  bank: string;
  /** 命中的是通路專屬規則還是全通路規則 */
  matchedChannel: 'exact' | 'all';
  /** 活動截止日，沒有就是常態回饋 */
  validUntil?: string;
}

/** 辦卡導流建議 */
export interface AffiliateSuggestion {
  card: CreditCard;
  paymentMethod: PaymentMethodMeta;
  totalRewardPct: number;
  /** 比使用者目前最佳高出多少百分點 */
  gapPct: number;
  userBestPct: number;
  note: string;
  capMonthly: number | null;
}

/** rewardEngine 的完整輸出 */
export interface RewardCalculationOutput {
  ranked: CalculatedRewardResult[];
  affiliate: AffiliateSuggestion | null;
}

/** public/data/rules.json */
export interface RulesDataset {
  version: string;
  updated_at: string;
  disclaimer: string;
  paymentMethods: PaymentMethodMeta[];
  cards: CreditCard[];
}

/** public/data/stores.json */
export interface StoresDataset {
  version: string;
  updated_at: string;
  disclaimer: string;
  match_radius_meters: number;
  channels: Array<Pick<StorePOI, 'id' | 'name' | 'category' | 'region'>>;
  stores: StorePOI[];
}

/** 使用者手動輸入一條回饋規則時的草稿 */
export interface CardRuleDraft {
  payment_method: PaymentMethodType | '';
  /** 'all' 或單一通路 id */
  channel: string;
  base_reward_pct: string;
  extra_reward_pct: string;
  cap_amount_monthly: string;
  note: string;
}

/** 皮夾備份格式（匯出成一段文字，換手機時貼回來） */
export interface WalletBackup {
  v: 1;
  exportedAt: string;
  ownedCardIds: string[];
  customCards: CreditCard[];
  carriers: CarrierItem[];
  /** 本月已用回饋額度；換手機時一起搬，否則新裝置會以為額度全新 */
  usage?: UsageMap;
  /** 每張卡的個人備註、年費資訊 */
  cardMeta?: Record<string, CardMeta>;
  /** 每張卡今年累積賺到的回饋，換手機時一起搬，否則年費淨值會從零開始算 */
  annualEarned?: Record<string, AnnualEarned>;
}

/** 一個可下載的地標包（依國家 × 地區切分） */
export interface PoiPack {
  id: string;
  region: RegionCode;
  /** 地區名稱，例如「台北市」「東京都」 */
  area: string;
  /** 顯示用完整標籤，例如「台灣 · 台北市」 */
  label: string;
  /** ready = 已產製可下載；pending = 還沒跑過 build-packs 產製 */
  status: 'ready' | 'pending';
  version: string;
  /** 收錄門市數，pending 時為估計值 */
  storeCount: number;
  /** 檔案大小（KB），pending 時為估計值 */
  sizeKb: number;
  /** [south, west, north, east]，給產製腳本用 */
  bbox: [number, number, number, number];
  /** 這個包收錄哪些通路 */
  channels: string[];
}

/** public/data/packs/index.json */
export interface PackIndex {
  version: string;
  updated_at: string;
  attribution: string;
  packs: PoiPack[];
}

/** 已安裝在這台裝置上的地標包 */
export interface InstalledPack {
  id: string;
  version: string;
  storeCount: number;
  sizeKb: number;
  installedAt: string;
  /** 線上是否有更新版本 */
  updateAvailable?: boolean;
}

/** 地標包下載狀態 */
export type PackTaskState = 'idle' | 'downloading' | 'error';

/** 條碼格式 */
export type BarcodeFormat = 'CODE39' | 'CODE128';

/** 載具種類 */
export type CarrierKind =
  | 'mobile' // 財政部手機條碼
  | 'natural' // 自然人憑證條碼
  | 'donation' // 捐贈碼
  | 'member' // 通路會員條碼（全聯、全家、屈臣氏…）
  | 'custom'; // 自訂

/** 一組手動輸入的條碼 */
export interface CarrierItem {
  id: string;
  kind: CarrierKind;
  /** 使用者自訂的顯示名稱，例如「我的手機條碼」 */
  label: string;
  /** 條碼內容 */
  value: string;
  format: BarcodeFormat;
  createdAt: string;
}

/** 各載具種類的輸入規則 */
export interface CarrierKindSpec {
  kind: CarrierKind;
  label: string;
  placeholder: string;
  format: BarcodeFormat;
  hint: string;
  /** 回傳 null 表示通過，否則回傳錯誤訊息 */
  validate: (value: string) => string | null;
}

/** 定位狀態 */
export type LocateStatus = 'idle' | 'locating' | 'success' | 'denied' | 'error';

/** Deep Link 執行結果 */
export interface DeepLinkResult {
  opened: boolean;
  reason?: 'no-scheme' | 'timeout' | 'blocked';
  fallbackUrl?: string;
}
