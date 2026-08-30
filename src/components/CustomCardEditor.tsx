import { useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import type {
  CardRewardRule,
  CardRuleDraft,
  CreditCard,
  PaymentMethodMeta,
  PaymentMethodType,
  StorePOI,
} from '../types';

interface CustomCardEditorProps {
  paymentMethods: PaymentMethodMeta[];
  channels: StorePOI[];
  /** 有值就是編輯模式 */
  editing?: CreditCard | null;
  onSave: (card: Omit<CreditCard, 'id' | 'custom'>) => void;
  onCancel: () => void;
}

const emptyRule = (): CardRuleDraft => ({
  payment_method: '',
  channel: 'all',
  base_reward_pct: '1',
  extra_reward_pct: '0',
  cap_amount_monthly: '',
  note: '',
});

function toDrafts(card: CreditCard | null | undefined): CardRuleDraft[] {
  if (!card?.rules?.length) return [emptyRule()];
  return card.rules.map((r) => ({
    payment_method: r.payment_method,
    channel: r.channels[0] ?? 'all',
    base_reward_pct: String(r.base_reward_pct),
    extra_reward_pct: String(r.extra_reward_pct),
    cap_amount_monthly: r.cap_amount_monthly === null ? '' : String(r.cap_amount_monthly),
    note: r.note ?? '',
  }));
}

const REGION_LABEL: Record<string, string> = { TW: '台灣', JP: '日本', KR: '韓國' };

export default function CustomCardEditor({
  paymentMethods,
  channels,
  editing,
  onSave,
  onCancel,
}: CustomCardEditorProps) {
  const [bank, setBank] = useState(editing?.bank ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [rules, setRules] = useState<CardRuleDraft[]>(toDrafts(editing));
  const [error, setError] = useState<string | null>(null);

  const updateRule = (index: number, patch: Partial<CardRuleDraft>) => {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const validRules = rules.filter((r) => r.payment_method !== '');

  const save = () => {
    if (!bank.trim() || !name.trim()) {
      setError('銀行與卡別都要填，例如「玉山銀行」＋「Unicard」');
      return;
    }
    if (validRules.length === 0) {
      setError('至少要有一條回饋規則，先選一個支付方式');
      return;
    }

    const parsed: CardRewardRule[] = validRules.map((r) => {
      const base = Number(r.base_reward_pct) || 0;
      const extra = Number(r.extra_reward_pct) || 0;
      const cap = r.cap_amount_monthly.trim() === '' ? null : Number(r.cap_amount_monthly);
      return {
        payment_method: r.payment_method as PaymentMethodType,
        channels: [r.channel],
        base_reward_pct: base,
        extra_reward_pct: extra,
        cap_amount_monthly: cap !== null && Number.isFinite(cap) ? cap : null,
        note: r.note.trim() || '自己輸入的規則',
      };
    });

    if (parsed.some((r) => r.base_reward_pct + r.extra_reward_pct <= 0)) {
      setError('回饋率要大於 0，不然這條規則不會有作用');
      return;
    }

    onSave({ bank: bank.trim(), name: name.trim(), rules: parsed });
  };

  // 通路依地區分組，出國用的通路不會跟台灣混在一起
  const grouped = ['TW', 'JP', 'KR'].map((region) => ({
    region,
    items: channels.filter((c) => (c.region ?? 'TW') === region),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="block rounded-2xl p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">
          {editing ? '編輯這張卡' : '自己新增一張卡'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="取消"
          className="tap flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-faint)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <p className="mt-1 text-[12px] leading-relaxed text-dim">
        照著銀行的活動頁填。填完就會參與試算，資料只存在這台裝置。
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={bank}
          onChange={(e) => setBank(e.target.value.slice(0, 12))}
          placeholder="銀行，例如 玉山銀行"
          aria-label="銀行"
          className="block-inset min-w-0 flex-1 rounded-xl px-3 py-2.5 text-[15px] outline-none placeholder:text-[var(--text-faint)]"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="卡別，例如 Unicard"
          aria-label="卡別"
          className="block-inset min-w-0 flex-1 rounded-xl px-3 py-2.5 text-[15px] outline-none placeholder:text-[var(--text-faint)]"
        />
      </div>

      <ul className="mt-3 space-y-2.5">
        {rules.map((rule, index) => (
          <li key={index} className="block-inset rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow">規則 {index + 1}</span>
              {rules.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`刪除規則 ${index + 1}`}
                  className="tap text-[var(--text-faint)]"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-faint">支付方式</span>
                <select
                  value={rule.payment_method}
                  onChange={(e) => updateRule(index, { payment_method: e.target.value as PaymentMethodType })}
                  className="w-full appearance-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[14px] text-[var(--text)] outline-none"
                >
                  <option value="">請選擇</option>
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] text-faint">適用通路</span>
                <select
                  value={rule.channel}
                  onChange={(e) => updateRule(index, { channel: e.target.value })}
                  className="w-full appearance-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[14px] text-[var(--text)] outline-none"
                >
                  <option value="all">全通路（台灣）</option>
                  {grouped.map((group) => (
                    <optgroup key={group.region} label={REGION_LABEL[group.region]}>
                      {group.items.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] text-faint">基本回饋 %</span>
                <input
                  value={rule.base_reward_pct}
                  onChange={(e) => updateRule(index, { base_reward_pct: e.target.value.replace(/[^0-9.]/g, '') })}
                  inputMode="decimal"
                  className="num w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[15px] outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] text-faint">加碼回饋 %</span>
                <input
                  value={rule.extra_reward_pct}
                  onChange={(e) => updateRule(index, { extra_reward_pct: e.target.value.replace(/[^0-9.]/g, '') })}
                  inputMode="decimal"
                  className="num w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[15px] outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] text-faint">每月上限（空白＝無上限）</span>
                <input
                  value={rule.cap_amount_monthly}
                  onChange={(e) => updateRule(index, { cap_amount_monthly: e.target.value.replace(/[^0-9]/g, '') })}
                  inputMode="numeric"
                  placeholder="500"
                  className="num w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[15px] outline-none placeholder:text-[var(--text-faint)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] text-faint">備註（門檻、需登錄…）</span>
                <input
                  value={rule.note}
                  onChange={(e) => updateRule(index, { note: e.target.value.slice(0, 60) })}
                  placeholder="需每月登錄"
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[14px] outline-none placeholder:text-[var(--text-faint)]"
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setRules((prev) => [...prev, emptyRule()])}
        className="tap mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--line)] text-[13px] font-medium"
      >
        <Plus size={15} aria-hidden />
        再加一條規則（不同支付或不同通路）
      </button>

      {error ? (
        <p className="mt-2.5 text-[12px] text-[var(--danger)]">{error}</p>
      ) : (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
          同一張卡在不同支付方式或不同通路的回饋不一樣，就多加幾條規則。
        </p>
      )}

      <button
        type="button"
        onClick={save}
        className="tap mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] text-[14px] font-bold text-[var(--accent-ink)]"
      >
        <Check size={16} aria-hidden />
        {editing ? '儲存修改' : '加入我的皮夾'}
      </button>
    </div>
  );
}
