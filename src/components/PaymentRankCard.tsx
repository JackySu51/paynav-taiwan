import { useState } from 'react';
import { ArrowUpRight, Check, ExternalLink, Flag, Info, PlusCircle, Star } from 'lucide-react';
import type { CalculatedRewardResult, DeepLinkResult, RegionCode } from '../types';
import { getScheme, isNfcMethodUnavailableOnThisDevice, isNfcTapMethod, NFC_TAP_GUIDANCE, openExternal, openPaymentApp } from '../utils/deepLink';
import { OVERSEAS_FEE_PCT, estimateCashback, formatPct } from '../utils/rewardEngine';
import { getPaymentIcon } from '../utils/icons';

interface PaymentRankCardProps {
  result: CalculatedRewardResult;
  /** 目前地區；海外時會顯示手續費提醒 */
  region?: RegionCode;
  /** 使用者輸入的消費金額，用來換算實拿金額 */
  amount: number;
  /** 記一筆：把這次拿到的回饋累加進本月已用額度 */
  onLogSpend: (usageKey: string, earned: number) => void;
  /** 回報這條規則不對，會開啟預先填好的 GitHub issue */
  onReportRule: (result: CalculatedRewardResult) => void;
  /**
   * 並列版面用的精簡樣式：跟另一張並列的卡片並排時使用，
   * 收起次要資訊（上限明細、海外提醒），保持兩張卡視覺份量一致。
   */
  compact?: boolean;
}

export default function PaymentRankCard({
  result,
  region = 'TW',
  amount,
  onLogSpend,
  onReportRule,
  compact = false,
}: PaymentRankCardProps) {
  const [logged, setLogged] = useState(false);
  const earned = estimateCashback(amount, result);
  const [fallback, setFallback] = useState<DeepLinkResult | null>(null);
  const Icon = getPaymentIcon(result.paymentMethod.iconName);
  const brand = result.paymentMethod.color;
  const hasScheme = Boolean(getScheme(result.paymentMethod));
  const infoUrl = result.paymentMethod.webFallback || result.paymentMethod.storeUrl || '';
  const isCardTap = ['physical', 'easycard', 'ipass_card'].includes(result.paymentMethod.id);
  const isNfcTap = isNfcTapMethod(result.paymentMethod.id);
  const deviceMismatch = isNfcTap && isNfcMethodUnavailableOnThisDevice(result.paymentMethod.id);
  // 沒有可靠的 scheme 就不要硬跳，改成開官網說明；亂跳只會換來 iOS 的錯誤彈窗
  const actionLabel = hasScheme
    ? '開啟 App'
    : isNfcTap
      ? '感應付款'
      : isCardTap
        ? '拿出實體卡'
        : '查看用法';

  // 名次徽章：真的並列（同名次不只一個）才講「並列」，單獨第一名就是「最佳選擇」
  const rankLabel =
    result.rank === 1
      ? result.tiedCount > 1
        ? `並列第 1 名`
        : '最佳選擇'
      : result.tiedCount > 1
        ? `並列第 ${result.rank} 名`
        : `NO.${result.rank}`;

  const handleOpen = () => {
    setFallback(null);
    if (hasScheme) {
      openPaymentApp(result.paymentMethod, (res) => setFallback(res));
      return;
    }
    if (isNfcTap) {
      setFallback({ opened: false, reason: 'no-scheme' });
      return;
    }
    if (!isCardTap && infoUrl) {
      openExternal(infoUrl);
      return;
    }
    setFallback({ opened: false, reason: 'no-scheme' });
  };

  return (
    <article
      className="animate-riseIn block relative overflow-hidden rounded-2xl"
      style={
        result.isBest
          ? { boxShadow: `0 8px 24px -14px ${brand}55` }
          : undefined
      }
    >
      {/* 品牌色光柱：唯一允許喧嘩的地方，玻璃材質不用在這種內容卡片上 */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${result.isBest ? 'animate-pulseRail' : ''}`}
        style={{ background: brand }}
      />

      <div className={compact ? 'py-3 pl-3.5 pr-3' : 'py-3.5 pl-4 pr-3.5'}>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-0.5 flex shrink-0 items-center justify-center rounded-xl ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
            style={{ background: `${brand}1F`, color: brand }}
          >
            <Icon size={compact ? 18 : 20} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {result.rank === 1 ? (
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-medium"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <Star size={10} fill="currentColor" aria-hidden />
                  {rankLabel}
                </span>
              ) : (
                <span className="num text-[11px] text-faint">{rankLabel}</span>
              )}
              {!compact && result.matchedChannel === 'exact' ? (
                <span className="rounded-full border border-[var(--line)] px-2 py-[3px] text-[10.5px] text-dim">
                  此通路專屬
                </span>
              ) : null}
            </div>

            <h3 className="mt-1.5 truncate text-[16px] font-semibold leading-tight">
              {result.paymentMethod.name}
            </h3>
            <p className="mt-0.5 truncate text-[13px] text-dim">綁 {result.cardName}</p>
            {!compact && result.paymentMethod.note ? (
              <p className="mt-0.5 truncate text-[11.5px] text-faint">
                {result.paymentMethod.note}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <div
              className={`tnum font-bold leading-none ${compact ? 'text-[20px]' : 'text-[26px]'}`}
              style={{ color: result.capExhausted || deviceMismatch ? 'var(--text-faint)' : brand }}
            >
              {formatPct(result.effectiveRewardPct)}
            </div>
            {deviceMismatch ? (
              <div className="num mt-0.5 text-[10.5px] text-[var(--danger)]">
                {result.paymentMethod.id === 'apple_pay' ? '僅 iPhone 支援' : '僅 Android 支援'}
              </div>
            ) : result.capExhausted ? (
              <div className="num mt-0.5 text-[10.5px] text-[var(--danger)]">
                上限已滿，原 {formatPct(result.totalRewardPct)}
              </div>
            ) : null}
            {!compact ? (
              <div className="num mt-1 text-[11px] text-faint">
                {formatPct(result.baseRewardPct)}
                {result.extraRewardPct > 0 ? ` + ${formatPct(result.extraRewardPct)}` : ''}
              </div>
            ) : null}
          </div>
        </div>

        <div className={`flex items-end justify-between gap-3 ${compact ? 'mt-2.5' : 'mt-3'}`}>
          <div className="min-w-0 flex-1">
            {!compact ? (
              <>
                <p className="text-[12px] leading-snug text-dim">{result.note}</p>
                <p className="num mt-1 text-[11px] text-faint">
                  {result.capMonthly === null
                    ? '無回饋上限'
                    : `本月剩 NT$${(result.capRemaining ?? result.capMonthly).toLocaleString('zh-TW')} / ${result.capMonthly.toLocaleString('zh-TW')}`}
                  {result.validUntil ? `．活動至 ${result.validUntil}` : ''}
                </p>
              </>
            ) : null}
            {amount > 0 ? (
              (() => {
                // 海外模式下，扣手續費後的實際淨賺金額，比單純顯示毛回饋更有意義——
                // 使用者站在收銀台前想知道的是「這樣刷划不划算」，不是回饋率本身
                const feeCost =
                  result.netOverseasRewardPct !== null
                    ? Math.round(((amount * OVERSEAS_FEE_PCT) / 100) * 100) / 100
                    : 0;
                const netEarned = Math.round((earned - feeCost) * 100) / 100;
                if (result.netOverseasRewardPct !== null) {
                  return (
                    <p
                      className="num mt-1 text-[11.5px]"
                      style={{ color: netEarned < 0 ? 'var(--danger)' : 'var(--success)' }}
                    >
                      刷 NT${amount.toLocaleString('zh-TW')} 回饋 NT${earned.toLocaleString('zh-TW')}
                      ，扣手續費 NT${feeCost.toLocaleString('zh-TW')} 淨賺 NT$
                      {netEarned.toLocaleString('zh-TW')}
                    </p>
                  );
                }
                return (
                  <p className="num mt-1 text-[11.5px] text-[var(--success)]">
                    {compact
                      ? `約回饋 NT$${earned.toLocaleString('zh-TW')}`
                      : `刷 NT$${amount.toLocaleString('zh-TW')} 約回饋 NT$${earned.toLocaleString('zh-TW')}`}
                  </p>
                );
              })()
            ) : null}
            {!compact && region !== 'TW' ? (
              result.netOverseasRewardPct !== null ? (
                <p
                  className="mt-1 text-[11px] font-medium leading-snug"
                  style={{
                    color:
                      result.netOverseasRewardPct < 0 ? 'var(--danger)' : 'var(--accent)',
                  }}
                >
                  扣 {OVERSEAS_FEE_PCT}% 國外交易服務費後，淨回饋約{' '}
                  {formatPct(result.netOverseasRewardPct)}
                  {result.netOverseasRewardPct < 0 ? '（淨損，不建議這樣刷）' : ''}
                  ，結帳請選當地幣別
                </p>
              ) : (
                <p className="mt-1 text-[11px] leading-snug text-[var(--accent)]">
                  帳戶扣款免海外手續費
                </p>
              )
            ) : null}
          </div>

          <div className={`flex shrink-0 items-center gap-1.5 ${compact ? '' : 'flex-col items-end'}`}>
          <button
            type="button"
            onClick={deviceMismatch ? undefined : handleOpen}
            disabled={deviceMismatch}
            className={`tap flex shrink-0 items-center gap-1.5 rounded-full font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
              compact ? 'h-9 px-3 text-[12.5px]' : 'h-10 px-4 text-[13.5px]'
            }`}
            style={
              deviceMismatch
                ? { background: 'var(--surface-3)', color: 'var(--text-faint)' }
                : result.isBest
                  ? { background: brand, color: '#fff' }
                  : { background: `${brand}24`, color: brand }
            }
          >
            {deviceMismatch ? '此裝置無法使用' : compact ? '開啟' : actionLabel}
            {!deviceMismatch && (hasScheme || (!isCardTap && infoUrl)) ? (
              <ArrowUpRight size={compact ? 14 : 16} aria-hidden />
            ) : null}
          </button>

          {!compact && amount > 0 && earned > 0 ? (
            <button
              type="button"
              onClick={() => {
                onLogSpend(result.usageKey, earned);
                setLogged(true);
                window.setTimeout(() => setLogged(false), 2000);
              }}
              className="tap flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-dim"
            >
              {logged ? (
                <>
                  <Check size={11} aria-hidden />
                  已記錄
                </>
              ) : (
                <>
                  <PlusCircle size={11} aria-hidden />
                  記一筆
                </>
              )}
            </button>
          ) : null}
          {/* 只在真正的第一名（含並列）顯示，避免每張卡都有按鈕變得干擾 */}
          {!compact && result.rank === 1 ? (
            <button
              type="button"
              onClick={() => onReportRule(result)}
              className="tap flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-faint"
              title="回報這條規則不對"
            >
              <Flag size={10} aria-hidden />
              數字不對？
            </button>
          ) : null}
          </div>
        </div>

        {fallback ? (
          <div className="block-inset mt-3 rounded-xl px-3 py-2.5">
            <p className="flex items-start gap-1.5 text-[12px] leading-snug text-dim">
              <Info size={13} className="mt-px shrink-0 text-[var(--accent)]" aria-hidden />
              {fallback.reason === 'no-scheme'
                ? isNfcTap
                  ? NFC_TAP_GUIDANCE[result.paymentMethod.id]
                  : '這個方式沒有 App 可以開，直接把卡或票證交給店員感應。'
                : `沒有跳出 ${result.paymentMethod.name}？可能還沒安裝，或系統擋掉了跳轉。`}
            </p>
            {fallback.reason !== 'no-scheme' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {result.paymentMethod.webFallback ? (
                  <button
                    type="button"
                    onClick={() => openExternal(result.paymentMethod.webFallback as string)}
                    className="tap flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px]"
                  >
                    打開官網
                    <ExternalLink size={12} aria-hidden />
                  </button>
                ) : null}
                {result.paymentMethod.storeUrl ? (
                  <button
                    type="button"
                    onClick={() => openExternal(result.paymentMethod.storeUrl as string)}
                    className="tap flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px]"
                  >
                    前往下載
                    <ExternalLink size={12} aria-hidden />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
