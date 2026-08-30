import { ExternalLink, TrendingUp } from 'lucide-react';
import type { AffiliateSuggestion } from '../types';
import { openExternal } from '../utils/deepLink';
import { formatCap, formatPct } from '../utils/rewardEngine';
import { getPaymentIcon } from '../utils/icons';

interface AffiliatePromoCardProps {
  suggestion: AffiliateSuggestion;
  storeName: string;
}

export default function AffiliatePromoCard({
  suggestion,
  storeName,
}: AffiliatePromoCardProps) {
  const Icon = getPaymentIcon(suggestion.paymentMethod.iconName);
  const brand = suggestion.paymentMethod.color;
  const applyUrl = suggestion.card.apply_url;

  return (
    <section
      className="animate-riseIn relative overflow-hidden rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-4 "
      aria-label="辦卡建議"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-[0.14]"
        style={{ background: brand }}
      />

      <div className="flex items-center gap-2">
        <TrendingUp size={15} className="text-[var(--accent)]" aria-hidden />
        <span className="eyebrow">在 {storeName} 你還能多賺</span>
      </div>

      <div className="mt-2.5 flex items-end gap-3">
        <div className="num text-[38px] font-bold leading-none text-[var(--accent)]">
          {formatPct(suggestion.totalRewardPct)}
        </div>
        <div className="num pb-1 text-[12px] text-dim">
          比你目前最高的 {formatPct(suggestion.userBestPct)} 多 {formatPct(suggestion.gapPct)}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${brand}1F`, color: brand }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">
            {suggestion.card.bank} {suggestion.card.name}
          </p>
          <p className="truncate text-[12px] text-dim">
            搭 {suggestion.paymentMethod.name}．{suggestion.note}
          </p>
        </div>
      </div>

      <p className="num mt-2 text-[11px] text-faint">{formatCap(suggestion.capMonthly)}</p>

      {applyUrl ? (
        <button
          type="button"
          onClick={() => openExternal(applyUrl)}
          className="tap mt-3.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] text-[14px] font-bold text-[var(--accent-ink)]"
        >
          看這張卡的申辦條件
          <ExternalLink size={15} aria-hidden />
        </button>
      ) : null}

      <p className="mt-2 text-center text-[10.5px] text-faint">
        連結會開到銀行官網．是否核卡由銀行決定
      </p>
    </section>
  );
}
