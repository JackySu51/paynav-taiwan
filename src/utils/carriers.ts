import type { CarrierItem, CarrierKind, CarrierKindSpec } from '../types';

/**
 * 載具與常用條碼的輸入規則。
 *
 * 為什麼要自己驗格式：財政部的 API 個人申請不到（見 docs/02），
 * 所以我們沒辦法問「這組條碼真的存在嗎」。
 * 能做的是把「明顯打錯」擋下來——長度、開頭、允許字元，
 * 這已經能攔掉絕大多數的手滑，剩下的由店員掃描時當場發現。
 */

/** 財政部手機條碼：斜線開頭 + 7 碼（大寫英數與 . - +） */
const MOBILE_PATTERN = /^\/[0-9A-Z.\-+]{7}$/;

export const CARRIER_SPECS: Record<CarrierKind, CarrierKindSpec> = {
  mobile: {
    kind: 'mobile',
    label: '手機條碼',
    placeholder: '/AB1234+',
    format: 'CODE39',
    hint: '財政部手機條碼，斜線開頭共 8 碼',
    validate: (value) =>
      MOBILE_PATTERN.test(value) ? null : '格式應為 / 開頭，後面 7 碼大寫英數或 . - +',
  },
  natural: {
    kind: 'natural',
    label: '自然人憑證條碼',
    placeholder: 'AB12345678901234',
    format: 'CODE39',
    hint: '自然人憑證卡號，2 碼英文 + 14 碼數字',
    validate: (value) =>
      /^[A-Z]{2}[0-9]{14}$/.test(value) ? null : '格式應為 2 碼大寫英文 + 14 碼數字',
  },
  donation: {
    kind: 'donation',
    label: '捐贈碼',
    placeholder: '8686',
    format: 'CODE39',
    hint: '愛心捐贈碼，3 到 7 碼數字',
    validate: (value) => (/^[0-9]{3,7}$/.test(value) ? null : '捐贈碼是 3 到 7 碼數字'),
  },
  member: {
    kind: 'member',
    label: '會員卡',
    placeholder: '會員卡號或條碼下方的數字',
    format: 'CODE128',
    hint: '全聯、全家、屈臣氏、星巴克等通路的會員條碼',
    validate: (value) =>
      /^[0-9A-Za-z-]{4,32}$/.test(value) ? null : '請輸入 4 到 32 碼英數（可含 -）',
  },
  custom: {
    kind: 'custom',
    label: '自訂條碼',
    placeholder: '任意內容',
    format: 'CODE128',
    hint: 'CODE128 可放英數與符號，長度 1 到 48',
    validate: (value) => (value.length >= 1 && value.length <= 48 ? null : '長度請在 1 到 48 之間'),
  },
};

/**
 * 常見會員卡的快速選項。
 * 選了之後名稱會自動填好，使用者只要輸入卡號——
 * 在櫃檯前少打幾個字就是這個 App 的全部意義。
 */
export const MEMBER_PRESETS: string[] = [
  // 台灣
  '全聯 PX Pay',
  '全家 My FamiPay',
  '7-ELEVEN OPENPOINT',
  '屈臣氏寵i',
  '康是美',
  '寶雅',
  '星巴克隨行卡',
  '家樂福好康卡',
  '誠品人',
  '大樹藥局',
  'IKEA Family',
  '燦坤會員',
  '藏壽司',
  'misterdonut',
  '全國電子會員',
  '大潤發會員',
  '愛買會員',
  // 日本
  'T-POINT（日本）',
  '楽天ポイント（日本）',
  'dポイント（日本）',
  'PONTA（日本）',
  'WAON（日本）',
  'nanaco（日本）',
  // 韓國
  'CJ ONE（韓國）',
  'Happy Point（韓國）',
  'L.POINT（韓國）',
];

/**
 * 通路 id → 對應的會員卡快速選項名稱（可以是多個）。
 *
 * 用途：GPS 判斷出目前通路後，檢查使用者有沒有對應的會員卡條碼，
 * 有的話在主畫面跳出「要不要出示會員卡」的提示（見 App.tsx 的
 * `matchedMemberCarrier`）。
 *
 * 台灣的通路是「品牌層級」（poya = 寶雅），所以對照是一對一、很精準。
 *
 * 日韓目前的通路只有「分類層級」（jp_convenience = 日本便利商店），
 * 沒有細到品牌（LAWSON / 7-11 / FamilyMart），所以這裡列出該分類
 * 常見的幾個點數系統，讓使用者自己判斷手上哪張適用——
 * 系統不知道你站在 LAWSON 還是 7-11，就不該假裝知道。
 * 之後如果 stores.json 補上 jp_lawson 這種品牌層級的通路 id，
 * 可以直接在這張表加一筆一對一的精準對照，不用改動其他程式碼。
 *
 * 刻意只收錄 stores.json 裡「現在真的存在」的通路 id——
 * MEMBER_PRESETS 裡有些選項（IKEA Family、誠品人、大樹藥局、藏壽司、
 * 燦坤會員、misterdonut、全國電子會員、愛買會員）目前還沒有對應的
 * 通路資料，先不列進這張對照表，不要為了湊完整而假造對照關係。
 */
export const CHANNEL_MEMBER_CARD_MAP: Record<string, string[]> = {
  // 台灣：品牌層級，一對一精準對照
  poya: ['寶雅'],
  watsons: ['屈臣氏寵i'],
  cosmed: ['康是美'],
  carrefour: ['家樂福好康卡'],
  rtmart: ['大潤發會員'],
  starbucks: ['星巴克隨行卡'],
  pxmart: ['全聯 PX Pay'],
  family_mart: ['全家 My FamiPay'],
  seven_eleven: ['7-ELEVEN OPENPOINT'],

  // 日本：便利商店已拆到品牌層級，一對一精準對照
  jp_lawson: ['PONTA（日本）'],
  jp_seven: ['nanaco（日本）'],
  jp_familymart: ['T-POINT（日本）', 'dポイント（日本）'], // 全家日本兩大點數並行，保留兩個候選
  jp_convenience: ['PONTA（日本）', 'nanaco（日本）', 'T-POINT（日本）', 'dポイント（日本）'], // 抓不到具體品牌時的分類層級備援
  jp_supermarket: ['WAON（日本）', '楽天ポイント（日本）', 'T-POINT（日本）'],
  jp_drugstore: ['dポイント（日本）', '楽天ポイント（日本）', 'T-POINT（日本）'],
  jp_department: ['楽天ポイント（日本）', 'dポイント（日本）'],
  jp_donki: ['楽天ポイント（日本）', 'dポイント（日本）'],
  jp_restaurant: ['dポイント（日本）', '楽天ポイント（日本）', 'PONTA（日本）'],

  // 韓國：便利商店已拆到品牌層級，一對一精準對照
  kr_cu: ['CJ ONE（韓國）'],
  kr_gs25: ['Happy Point（韓國）'],
  kr_convenience: ['CJ ONE（韓國）', 'Happy Point（韓國）', 'L.POINT（韓國）'], // 抓不到具體品牌時的分類層級備援
  kr_cosmetics: ['CJ ONE（韓國）', 'L.POINT（韓國）'],
  kr_department: ['L.POINT（韓國）', 'Happy Point（韓國）'],
  kr_restaurant: ['CJ ONE（韓國）', 'Happy Point（韓國）'],
};

export const CARRIER_KIND_ORDER: CarrierKind[] = [
  'mobile',
  'natural',
  'donation',
  'member',
  'custom',
];

/** 手機條碼要自動轉大寫，會員條碼可能區分大小寫 */
export function normalizeCarrierValue(kind: CarrierKind, raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (kind === 'member' || kind === 'custom') return trimmed;
  return trimmed.toUpperCase();
}

export function validateCarrier(kind: CarrierKind, value: string): string | null {
  return CARRIER_SPECS[kind].validate(value);
}

/** 舊版單一手機條碼的相容檢查，其他元件仍在用 */
export function isValidCarrier(value: string): boolean {
  return validateCarrier('mobile', value) === null;
}

export function createCarrier(
  kind: CarrierKind,
  value: string,
  label?: string,
): CarrierItem {
  const spec = CARRIER_SPECS[kind];
  return {
    id: `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    label: label?.trim() || spec.label,
    value: normalizeCarrierValue(kind, value),
    format: spec.format,
    createdAt: new Date().toISOString(),
  };
}

/** CODE39 只吃大寫英數與 - . $ / + % 與空白；不合的字元要改用 CODE128 */
export function suggestFormat(kind: CarrierKind, value: string) {
  if (CARRIER_SPECS[kind].format === 'CODE128') return 'CODE128' as const;
  return /^[0-9A-Z\-.$/+% ]*$/.test(value) ? ('CODE39' as const) : ('CODE128' as const);
}
