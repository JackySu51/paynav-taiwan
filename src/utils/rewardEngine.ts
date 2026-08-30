import type {
  AffiliateSuggestion,
  CalculatedRewardResult,
  CardRewardRule,
  CreditCard,
  PaymentMethodMeta,
  PaymentMethodType,
  RegionCode,
  UsageMap,
  RewardCalculationOutput,
} from '../types';

/** 記帳用的 key：上限是綁在「這張卡的這個支付方式」上 */
/**
 * 走信用卡清算網路的付款方式，海外會被收國外交易服務費；
 * 帳戶直接扣款的（電支帳戶、悠遊付等）不會被收這筆費用。
 * PaymentRankCard.tsx 的顯示邏輯共用這個常數，不要各自維護一份。
 */
export const CARD_NETWORK_METHODS: PaymentMethodType[] = [
  'physical',
  'apple_pay',
  'google_pay',
  'samsung_pay',
];

/** 國外交易服務費的估計值（新台幣計價的信用卡海外消費，多數銀行約落在這個區間） */
export const OVERSEAS_FEE_PCT = 1.5;

export function usageKeyOf(cardId: string, method: PaymentMethodType): string {
  return `${cardId}|${method}`;
}

/** 目前月份字串，例如 2026-08 */
export function currentMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 神卡比使用者現有卡片高出幾個百分點才值得推薦辦卡 */
export const DEFAULT_AFFILIATE_GAP_PCT = 3;

interface RuleCandidate {
  card: CreditCard;
  rule: CardRewardRule;
  total: number;
  matchedChannel: 'exact' | 'all';
  /** 扣掉本月已用上限後真正拿得到的回饋率 */
  effective: number;
  capRemaining: number | null;
  capExhausted: boolean;
  usageKey: string;
}

/** 規則是否命中當前通路 */
/**
 * 品牌通路 → 所屬分類。
 *
 * 日韓的地標資料現在細到品牌層級（jp_lawson、kr_cu 這種），但回饋規則
 * 繼續寫在分類層級（jp_convenience、kr_convenience）——這樣新增品牌
 * 不用回頭改任何一條已經驗證過的規則，只要在這裡加一行對照就好。
 *
 * isRuleMatched() 判斷時，除了看規則的 channels 有沒有直接列出這個品牌 id，
 * 也會往上查這個品牌屬於哪個分類，分類有列在 channels 裡一樣算符合。
 */
export const BRAND_TO_CATEGORY: Record<string, string> = {
  // 日本便利商店
  jp_seven: 'jp_convenience',
  jp_lawson: 'jp_convenience',
  jp_familymart: 'jp_convenience',
  // 韓國便利商店
  kr_cu: 'kr_convenience',
  kr_gs25: 'kr_convenience',
  kr_seven: 'kr_convenience',
  kr_emart24: 'kr_convenience',
};

export function isRuleMatched(rule: CardRewardRule, storeId: string): boolean {
  if (rule.channels.includes(storeId) || rule.channels.includes('all')) return true;
  const category = BRAND_TO_CATEGORY[storeId];
  return category !== undefined && rule.channels.includes(category);
}

function toTotal(rule: CardRewardRule): number {
  const total = (rule.base_reward_pct ?? 0) + (rule.extra_reward_pct ?? 0);
  // 避免 0.1 + 0.2 = 0.30000000000000004
  return Math.round(total * 100) / 100;
}

/** 上限越大越好，null 視為無限大 */
function capScore(cap: number | null): number {
  return cap === null ? Number.POSITIVE_INFINITY : cap;
}

/**
 * 同一支付方式下比較兩筆規則：
 * 回饋率高 > 通路專屬規則 > 每月上限高
 */
function betterCandidate(a: RuleCandidate, b: RuleCandidate): RuleCandidate {
  // 關鍵：先比「扣掉已用上限後真正拿得到的」。
  // 否則某張卡的上限滿了，還是會被選出來當代表，
  // 而另一張同樣支援這個支付、額度還沒用的卡就被藏起來了。
  if (a.effective !== b.effective) return a.effective > b.effective ? a : b;
  if (a.total !== b.total) return a.total > b.total ? a : b;
  if (a.matchedChannel !== b.matchedChannel) {
    return a.matchedChannel === 'exact' ? a : b;
  }
  return capScore(a.rule.cap_amount_monthly) >= capScore(b.rule.cap_amount_monthly) ? a : b;
}

/**
 * 收集某批卡片在指定通路下的所有命中規則。
 *
 * 地區規則很重要：`channels: ['all']` 的意思是「台灣所有通路」，不是「全世界」。
 * 玉山 Unicard 的行動支付 3% 不會在東京的超商生效，
 * 悠遊付、icash Pay 這些工具在日本根本刷不到。
 * 所以出國時只認明確寫出 jp_ / kr_ 通路的規則，
 * 而且該支付工具必須在 paymentMethods 的 overseas 裡標明支援那個地區。
 */
function collectCandidates(
  cards: CreditCard[],
  storeId: string,
  region: RegionCode,
  metaById: Map<PaymentMethodType, PaymentMethodMeta>,
  usage: UsageMap = {},
  month: string = currentMonth(),
): RuleCandidate[] {
  const candidates: RuleCandidate[] = [];
  const overseas = region !== 'TW';

  for (const card of cards) {
    for (const rule of card.rules) {
      if (!isRuleMatched(rule, storeId)) continue;

      const exact = rule.channels.includes(storeId);
      if (overseas) {
        // 海外只吃通路專屬規則，不讓 'all' 跨國生效
        if (!exact) continue;
        const meta = metaById.get(rule.payment_method);
        if (!meta?.overseas?.includes(region)) continue;
      }

      const usageKey = usageKeyOf(card.id, rule.payment_method);
      const record = usage[usageKey];
      const earned = record?.month === month ? record.earned : 0;
      const cap = rule.cap_amount_monthly;
      const capRemaining =
        cap === null ? null : Math.max(0, Math.round((cap - earned) * 100) / 100);
      const capExhausted = capRemaining !== null && capRemaining <= 0;
      const total = toTotal(rule);

      candidates.push({
        card,
        rule,
        total,
        matchedChannel: exact ? 'exact' : 'all',
        // 上限用完就只剩基本回饋，加碼那段不會再給
        effective: capExhausted ? rule.base_reward_pct : total,
        capRemaining,
        capExhausted,
        usageKey,
      });
    }
  }
  return candidates;
}

/** 依支付方式分組，各取最高回饋的一筆 */
function bestPerPaymentMethod(
  candidates: RuleCandidate[],
): Map<PaymentMethodType, RuleCandidate> {
  const map = new Map<PaymentMethodType, RuleCandidate>();
  for (const candidate of candidates) {
    const key = candidate.rule.payment_method;
    const current = map.get(key);
    map.set(key, current ? betterCandidate(current, candidate) : candidate);
  }
  return map;
}

/**
 * 複合回饋試算引擎。
 *
 * 1. 遍歷使用者持有的卡片
 * 2. 檢查規則是否命中當前通路
 * 3. 總回饋率 = base + extra
 * 4. 依支付方式分組取最高
 * 5. 依總回饋率降序排列
 * 6. 另找出「非持有」但該通路最高的神卡作為辦卡導流
 */
export function calculateRewards(params: {
  selectedStoreId: string;
  /** 目前地區，預設台灣 */
  region?: RegionCode;
  userOwnedCardIds: string[];
  allCards: CreditCard[];
  paymentMethods: PaymentMethodMeta[];
  affiliateGapThreshold?: number;
  /** 本月已用掉的回饋額度 */
  usage?: UsageMap;
}): RewardCalculationOutput {
  const {
    selectedStoreId,
    region = 'TW',
    userOwnedCardIds,
    allCards,
    paymentMethods,
    affiliateGapThreshold = DEFAULT_AFFILIATE_GAP_PCT,
    usage = {},
  } = params;

  const month = currentMonth();

  const metaById = new Map<PaymentMethodType, PaymentMethodMeta>(
    paymentMethods.map((m) => [m.id, m]),
  );
  const ownedSet = new Set(userOwnedCardIds);
  // always_available 的項目（例如電支帳戶扣款）不需要使用者勾選就會參與試算，
  // 但它不是「卡」，所以也不該出現在辦卡導流裡。
  const ownedCards = allCards.filter((c) => ownedSet.has(c.id) || c.always_available);
  const otherCards = allCards.filter((c) => !ownedSet.has(c.id) && !c.always_available);

  const ownedBest = bestPerPaymentMethod(
    collectCandidates(ownedCards, selectedStoreId, region, metaById, usage, month),
  );

  const ranked: CalculatedRewardResult[] = [...ownedBest.values()]
    .filter((c) => metaById.has(c.rule.payment_method))
    .map((c) => {
      const meta = metaById.get(c.rule.payment_method) as PaymentMethodMeta;
      const incursOverseasFee = region !== 'TW' && CARD_NETWORK_METHODS.includes(meta.id);
      const netOverseasRewardPct = incursOverseasFee
        ? Math.round((c.effective - OVERSEAS_FEE_PCT) * 100) / 100
        : null;
      return {
        paymentMethod: meta,
        effectiveRewardPct: c.effective,
        netOverseasRewardPct,
        capRemaining: c.capRemaining,
        capExhausted: c.capExhausted,
        usageKey: c.usageKey,
        cardName: `${c.card.bank} ${c.card.name}`,
        cardId: c.card.id,
        bank: c.card.bank,
        totalRewardPct: c.total,
        baseRewardPct: c.rule.base_reward_pct,
        extraRewardPct: c.rule.extra_reward_pct,
        capMonthly: c.rule.cap_amount_monthly,
        note: c.rule.note,
        matchedChannel: c.matchedChannel,
        validUntil: c.rule.valid_until,
        isBest: false,
        rank: 0,
        tiedCount: 1,
      };
    })
    .sort((a, b) => {
      // 海外模式下排序看「淨回饋率」（扣掉國外交易服務費），不是原始回饋率——
      // 原始回饋率比較高的卡，扣完手續費可能反而比帳戶扣款划算的方式差，
      // 這裡才是使用者站在收銀台前真正該比較的數字。
      const aRank = a.netOverseasRewardPct ?? a.effectiveRewardPct;
      const bRank = b.netOverseasRewardPct ?? b.effectiveRewardPct;
      if (bRank !== aRank) {
        return bRank - aRank;
      }
      if (b.totalRewardPct !== a.totalRewardPct) return b.totalRewardPct - a.totalRewardPct;
      if (a.matchedChannel !== b.matchedChannel) return a.matchedChannel === 'exact' ? -1 : 1;
      return capScore(b.capMonthly) - capScore(a.capMonthly);
    });

  /**
   * 並列判斷：效果相同（容許 0.05 個百分點的浮點誤差）就算平手，
   * 共用同一個名次，而不是排序上先出現的那個就叫「第一名」。
   * 使用者站在收銀台前，兩個選項真的一樣划算時，不該有一個被說成比較差。
   * 海外模式一樣是拿淨回饋率（扣手續費後）做比較，跟排序用同一套基準。
   */
  const TIE_EPSILON = 0.05;
  const rankingValueOf = (r: CalculatedRewardResult) =>
    r.netOverseasRewardPct ?? r.effectiveRewardPct;
  let currentRank = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    const isNewRank =
      i === 0 || Math.abs(rankingValueOf(ranked[i]) - rankingValueOf(ranked[i - 1])) > TIE_EPSILON;
    if (isNewRank) currentRank += 1;
    ranked[i].rank = currentRank;
  }
  const rankOneCount = ranked.filter((r) => r.rank === 1).length;
  for (const r of ranked) {
    if (r.rank === 1) {
      r.isBest = true;
      r.tiedCount = rankOneCount;
    }
  }

  const userBestPct = ranked.length > 0 ? rankingValueOf(ranked[0]) : 0;
  const affiliate = findAffiliateSuggestion({
    otherCards,
    selectedStoreId,
    region,
    metaById,
    userBestPct,
    gapThreshold: affiliateGapThreshold,
  });

  return { ranked, affiliate };
}

/** 找出使用者沒有、但在此通路明顯更強的一張卡 */
function findAffiliateSuggestion(params: {
  otherCards: CreditCard[];
  selectedStoreId: string;
  region: RegionCode;
  metaById: Map<PaymentMethodType, PaymentMethodMeta>;
  userBestPct: number;
  gapThreshold: number;
}): AffiliateSuggestion | null {
  const { otherCards, selectedStoreId, region, metaById, userBestPct, gapThreshold } = params;

  const candidates = collectCandidates(otherCards, selectedStoreId, region, metaById)
    .filter((c) => metaById.has(c.rule.payment_method))
    .filter((c) => Boolean(c.card.apply_url));

  if (candidates.length === 0) return null;

  /**
   * 候選卡也要扣海外手續費才能跟 userBestPct 比——
   * userBestPct 傳進來時已經是淨值（海外模式扣過手續費），如果這裡拿
   * 沒扣手續費的毛回饋率去比，會高估辦這張卡的好處，推薦出一張
   * 「看起來高 2%、實際扣完手續費根本沒比較好」的卡。兩邊基準要一致。
   */
  const netOf = (c: (typeof candidates)[number]) =>
    region !== 'TW' && CARD_NETWORK_METHODS.includes(c.rule.payment_method)
      ? Math.round((c.total - OVERSEAS_FEE_PCT) * 100) / 100
      : c.total;

  const top = candidates.reduce((best, c) => {
    const cNet = netOf(c);
    const bestNet = netOf(best);
    if (cNet !== bestNet) return cNet > bestNet ? c : best;
    // 同回饋率時，優先推主打神卡
    const cFlag = c.rule.is_affiliate_highlight ? 1 : 0;
    const bFlag = best.rule.is_affiliate_highlight ? 1 : 0;
    if (cFlag !== bFlag) return cFlag > bFlag ? c : best;
    return capScore(c.rule.cap_amount_monthly) > capScore(best.rule.cap_amount_monthly) ? c : best;
  });

  const topNet = netOf(top);
  const gapPct = Math.round((topNet - userBestPct) * 100) / 100;
  if (gapPct < gapThreshold) return null;

  return {
    card: top.card,
    paymentMethod: metaById.get(top.rule.payment_method) as PaymentMethodMeta,
    totalRewardPct: top.total,
    gapPct,
    userBestPct,
    note: top.rule.note,
    capMonthly: top.rule.cap_amount_monthly,
  };
}

/**
 * 用一筆金額換算實拿回饋，並把本月剩餘額度算進去。
 * 加碼部分碰到上限就停，基本回饋通常不受限，所以分開算。
 */
export function estimateCashback(amount: number, result: CalculatedRewardResult): number {
  if (amount <= 0) return 0;

  const base = (amount * result.baseRewardPct) / 100;
  const extra = (amount * result.extraRewardPct) / 100;

  if (result.capMonthly === null) return Math.round((base + extra) * 100) / 100;

  const remaining = result.capRemaining ?? result.capMonthly;
  const cappedExtra = Math.max(0, Math.min(extra, remaining));
  return Math.round((base + cappedExtra) * 100) / 100;
}

/** 3 → "3%"；3.3 → "3.3%" */
export function formatPct(pct: number): string {
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** 回饋上限文字 */
export function formatCap(cap: number | null): string {
  return cap === null ? '無回饋上限' : `每月回饋上限 NT$${cap.toLocaleString('zh-TW')}`;
}
