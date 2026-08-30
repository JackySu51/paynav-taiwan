import { useState } from 'react';
import { ArrowRight, Check, ScanLine, Sparkles, Wallet } from 'lucide-react';

interface OnboardingStep {
  title: string;
  description: string;
  icon: 'scan' | 'wallet' | 'sparkles';
}

interface OnboardingProps {
  onFinish: () => void;
}

const iconMap = {
  scan: ScanLine,
  wallet: Wallet,
  sparkles: Sparkles,
} as const;

/**
 * 首次引導：三張全螢幕圖，講清楚這個 App 做什麼、你要做什麼、然後就能開始用。
 *
 * 視覺與互動規格在 Bolt 原型階段定案：色票、字體、可回上一步都照那一版。
 * 內容維持原本的三件事，不多不少：
 * 1. 這個 App 幫你決定「當下該用哪張卡」
 * 2. 你要先把手邊的卡告訴我們（只需要一次）
 * 3. 之後走進店裡就會自動推薦
 *
 * 不放的東西：地標包、載具、記帳、備份——這些等使用者遇到再自然發現。
 */
const steps: OnboardingStep[] = [
  {
    title: '走進店裡三秒，知道刷哪張卡',
    description: '台灣支付導航幫你在結帳前找出回饋最高的卡片組合，不再猶豫。',
    icon: 'scan',
  },
  {
    title: '先告訴我們你有哪些卡',
    description: '打開皮夾，把你手上的信用卡加入清單，推薦才會準。',
    icon: 'wallet',
  },
  {
    title: '走進店裡就會自動推薦',
    description: '選好通路，App 立刻告訴你該用哪個支付配哪張卡最划算。',
    icon: 'sparkles',
  },
];

export default function Onboarding({ onFinish }: OnboardingProps) {
  const [current, setCurrent] = useState(0);
  const isLast = current === steps.length - 1;
  const step = steps[current];
  const Icon = iconMap[step.icon];

  const next = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setCurrent((c) => Math.min(c + 1, steps.length - 1));
  };
  const back = () => setCurrent((c) => Math.max(c - 1, 0));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)] safe-top safe-bottom">
      <div className="flex justify-end px-5 pt-2">
        <button
          type="button"
          onClick={onFinish}
          className="tap text-[13px] text-dim underline underline-offset-4"
        >
          跳過
        </button>
      </div>

      <div
        className="animate-fadeIn flex flex-1 flex-col items-center justify-center px-8 text-center"
        key={current}
      >
        <div
          className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <Icon size={36} strokeWidth={1.5} aria-hidden />
        </div>

        <h1
          className="mb-4 max-w-xs whitespace-pre-line text-[24px] font-semibold leading-snug"
          style={{ letterSpacing: '-0.01em' }}
        >
          {step.title}
        </h1>

        <p className="max-w-xs text-[15px] leading-relaxed text-dim">{step.description}</p>
      </div>

      <div className="flex flex-col items-center gap-5 px-6 pb-4">
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? 'w-6' : 'w-1.5 bg-[var(--line-strong)]'
              }`}
              style={i === current ? { background: 'var(--accent)' } : undefined}
            />
          ))}
        </div>

        <div className="flex w-full max-w-[22rem] items-center gap-3">
          {current > 0 ? (
            <button
              type="button"
              onClick={back}
              className="tap shrink-0 px-4 py-3 text-[14px] font-medium text-dim"
            >
              上一步
            </button>
          ) : null}
          <button
            type="button"
            onClick={next}
            className="tap btn-primary flex h-12 flex-1 items-center justify-center gap-2 text-[15px]"
          >
            {isLast ? (
              <>
                <Check size={18} aria-hidden />
                開始使用
              </>
            ) : (
              <>
                下一步
                <ArrowRight size={18} aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
