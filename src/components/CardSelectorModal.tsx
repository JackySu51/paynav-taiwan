import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, NotebookPen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type {
  AnnualEarned,
  CardMeta,
  CarrierItem,
  CarrierKind,
  CreditCard,
  PaymentMethodMeta,
  StorePOI,
} from '../types';
import CustomCardEditor from './CustomCardEditor';
import { formatPct } from '../utils/rewardEngine';
import {
  CARRIER_KIND_ORDER,
  CARRIER_SPECS,
  normalizeCarrierValue,
  validateCarrier,
} from '../utils/carriers';

interface CardSelectorModalProps {
  open: boolean;
  cards: CreditCard[];
  ownedCardIds: string[];
  carriers: CarrierItem[];
  activeCarrierId: string | null;
  onToggleCard: (cardId: string) => void;
  onAddCarrier: (kind: CarrierKind, value: string, label?: string) => void;
  onRemoveCarrier: (id: string) => void;
  onSelectCarrier: (id: string) => void;
  /** 自訂卡片相關 */
  paymentMethods: PaymentMethodMeta[];
  channels: StorePOI[];
  onAddCustomCard: (card: Omit<CreditCard, 'id' | 'custom'>) => void;
  onUpdateCustomCard: (cardId: string, card: Omit<CreditCard, 'id' | 'custom'>) => void;
  onRemoveCustomCard: (cardId: string) => void;
  /** 每張卡的個人備註、年費，以及年費淨值判斷用的年度累積回饋 */
  cardMeta: Record<string, CardMeta>;
  annualEarned: Record<string, AnnualEarned>;
  onSetCardMeta: (cardId: string, patch: Partial<CardMeta>) => void;
  /** 皮夾備份與還原 */
  onExportWallet: () => string;
  onImportWallet: (payload: string) => string | null;
  onClose: () => void;
}

/** 這張卡目前最漂亮的一條規則，讓使用者一眼看出值不值得留 */
function headlineRule(card: CreditCard): string {
  const best = card.rules.reduce((top, rule) => {
    const total = rule.base_reward_pct + rule.extra_reward_pct;
    const topTotal = top.base_reward_pct + top.extra_reward_pct;
    return total > topTotal ? rule : top;
  }, card.rules[0]);

  if (!best) return '尚無收錄規則';
  const total = Math.round((best.base_reward_pct + best.extra_reward_pct) * 100) / 100;
  const scope = best.channels.includes('all') ? '全通路' : '指定通路';
  return `最高 ${formatPct(total)}．${scope}`;
}

/**
 * 年費淨值判斷：今年這張卡實際賺了多少回饋（拿現有的記帳資料算，
 * 不是另外做一套追蹤），直接跟年費比較——參考美國 MaxRewards 的做法。
 */
function annualFeeSummary(fee: number, earned: number): { text: string; positive: boolean } {
  const diff = Math.round((earned - fee) * 100) / 100;
  if (diff >= 0) {
    return { text: `已回本，多賺 NT$${diff.toLocaleString('zh-TW')}`, positive: true };
  }
  return { text: `還差 NT$${Math.abs(diff).toLocaleString('zh-TW')} 才回本`, positive: false };
}

/** 皮夾裡的精簡新增表單 */
function CarrierQuickAdd({
  onAdd,
  onCancel,
}: {
  onAdd: (kind: CarrierKind, value: string) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<CarrierKind>('mobile');
  const [value, setValue] = useState('');
  const spec = CARRIER_SPECS[kind];
  const normalized = normalizeCarrierValue(kind, value);
  const error = value ? validateCarrier(kind, normalized) : null;
  const ready = value.length > 0 && !error;

  return (
    <div>
      <div className="scroll-x -mx-1 flex gap-1.5 px-1 pb-2">
        {CARRIER_KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setValue('');
            }}
            className={`tap shrink-0 rounded-full border px-2.5 py-1 text-[12px] ${
              k === kind
                ? 'border-[var(--accent)] bg-[var(--surface-2)] font-medium'
                : 'border-[var(--line)] text-dim'
            }`}
          >
            {CARRIER_SPECS[k].label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 48))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ready) onAdd(kind, normalized);
          }}
          placeholder={spec.placeholder}
          autoCapitalize={kind === 'member' || kind === 'custom' ? 'off' : 'characters'}
          autoCorrect="off"
          spellCheck={false}
          aria-label={spec.label}
          className="num block-inset min-w-0 flex-1 rounded-xl px-3 py-2.5 text-[16px] tracking-[0.08em] outline-none placeholder:text-[var(--text-faint)]"
        />
        <button
          type="button"
          onClick={() => ready && onAdd(kind, normalized)}
          disabled={!ready}
          aria-label="儲存"
          className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] disabled:opacity-35"
        >
          <Check size={18} aria-hidden />
        </button>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <p className={`text-[11.5px] ${error ? 'text-[var(--danger)]' : 'text-faint'}`}>
          {error ?? spec.hint}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="tap shrink-0 text-[12px] text-dim underline underline-offset-4"
        >
          取消
        </button>
      </div>
    </div>
  );
}

export default function CardSelectorModal({
  open,
  cards,
  ownedCardIds,
  carriers,
  activeCarrierId,
  onToggleCard,
  onAddCarrier,
  onRemoveCarrier,
  onSelectCarrier,
  paymentMethods,
  channels,
  onAddCustomCard,
  onUpdateCustomCard,
  onRemoveCustomCard,
  cardMeta,
  annualEarned,
  onSetCardMeta,
  onExportWallet,
  onImportWallet,
  onClose,
}: CardSelectorModalProps) {
  const [keyword, setKeyword] = useState('');
  const [expandedMetaId, setExpandedMetaId] = useState<string | null>(null);
  const [addingCarrier, setAddingCarrier] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return cards;
    return cards.filter((card) =>
      `${card.bank}${card.name}${card.id}`.toLowerCase().includes(kw),
    );
  }, [cards, keyword]);

  if (!open) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="關閉皮夾"
        onClick={onClose}
        className="absolute inset-0 animate-fadeIn bg-[var(--scrim)] backdrop-blur-sm"
      />

      <div className="glass-sheet max-h-sheet relative flex w-full animate-sheetUp flex-col rounded-t-[28px]">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <div className="eyebrow">MY WALLET</div>
            <h2 className="mt-1 text-[19px] font-semibold tracking-tight">我的皮夾</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="tap flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)]"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-4">
          {/* 條碼載具：可以放多組 */}
          <section className="block mt-2 rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium">我的條碼</h3>
              <span className="num text-[11px] text-faint">{carriers.length} 組</span>
            </div>

            {carriers.length > 0 ? (
              <ul className="mt-2.5 space-y-1.5">
                {carriers.map((c) => (
                  <li
                    key={c.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                      c.id === activeCarrierId
                        ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                        : 'border-[var(--line)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCarrier(c.id)}
                      className="tap min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[14px] font-medium">{c.label}</span>
                      <span className="num mt-0.5 block truncate text-[12px] tracking-[0.08em] text-dim">
                        {c.value}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveCarrier(c.id)}
                      aria-label={`刪除 ${c.label}`}
                      className="tap shrink-0 text-[var(--text-faint)]"
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">
                手機條碼、捐贈碼、會員條碼都可以手動輸入。內容只存在這台裝置。
              </p>
            )}

            {addingCarrier ? (
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <CarrierQuickAdd
                  onAdd={(kind, value) => {
                    onAddCarrier(kind, value);
                    setAddingCarrier(false);
                  }}
                  onCancel={() => setAddingCarrier(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCarrier(true)}
                className="tap mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--line)] text-[13px] font-medium"
              >
                <Plus size={15} aria-hidden />
                新增一組條碼
              </button>
            )}
          </section>

          {/* 搜尋 */}
          <div className="block mt-4 flex items-center gap-2 rounded-full px-3.5 py-2.5">
            <Search size={16} className="shrink-0 text-[var(--text-faint)]" aria-hidden />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜尋銀行或卡別，例如 CUBE"
              aria-label="搜尋卡片"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--text-faint)]"
            />
            {keyword ? (
              <button
                type="button"
                onClick={() => setKeyword('')}
                aria-label="清除搜尋"
                className="tap text-[var(--text-faint)]"
              >
                <X size={16} aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 px-1">
            <p className="text-[12px] text-dim">
              勾選你手上真的有的卡．已選 {ownedCardIds.length} 張
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingCard(null);
                setEditorOpen((v) => !v);
              }}
              className="tap flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent)] px-2.5 py-1 text-[12px] font-medium"
            >
              <Plus size={13} aria-hidden />
              新增卡片
            </button>
          </div>

          {editorOpen ? (
            <div className="mt-2">
              <CustomCardEditor
                paymentMethods={paymentMethods}
                channels={channels}
                editing={editingCard}
                onSave={(card) => {
                  if (editingCard) onUpdateCustomCard(editingCard.id, card);
                  else onAddCustomCard(card);
                  setEditorOpen(false);
                  setEditingCard(null);
                }}
                onCancel={() => {
                  setEditorOpen(false);
                  setEditingCard(null);
                }}
              />
            </div>
          ) : null}

          <ul className="mt-2 space-y-2">
            {filtered.map((card) => {
              const owned = ownedCardIds.includes(card.id);
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onToggleCard(card.id)}
                    aria-pressed={owned}
                    className={`tap flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left ${
                      owned
                        ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                        : 'border-[var(--line)] bg-[var(--surface)]'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        owned
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                          : 'border-[var(--line)]'
                      }`}
                    >
                      {owned ? <Check size={15} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {card.bank} {card.name}
                        {card.custom ? (
                          <span className="ml-1.5 rounded-full border border-[var(--line)] px-1.5 py-[1px] text-[10px] font-normal text-dim">
                            自訂
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-dim">
                        {headlineRule(card)}
                      </span>
                    </span>
                  </button>

                  {owned ? (
                    <div className="mt-1.5 px-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMetaId((id) => (id === card.id ? null : card.id))
                        }
                        className="tap flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] text-dim"
                      >
                        <NotebookPen size={12} aria-hidden />
                        備註／年費
                        {cardMeta[card.id]?.annualFee ? (
                          <span
                            className={`ml-0.5 num text-[10.5px] font-medium ${
                              (annualEarned[card.id]?.year === new Date().getFullYear()
                                ? annualEarned[card.id].total
                                : 0) >= (cardMeta[card.id]?.annualFee ?? 0)
                                ? 'text-[var(--success)]'
                                : 'text-[var(--text-faint)]'
                            }`}
                          >
                            ·{' '}
                            {annualFeeSummary(
                              cardMeta[card.id]?.annualFee ?? 0,
                              annualEarned[card.id]?.year === new Date().getFullYear()
                                ? annualEarned[card.id].total
                                : 0,
                            ).text}
                          </span>
                        ) : null}
                      </button>

                      {expandedMetaId === card.id ? (
                        <div className="block-inset mt-2 space-y-2.5 rounded-xl p-3">
                          <div>
                            <label
                              htmlFor={`note-${card.id}`}
                              className="mb-1 block text-[11.5px] text-dim"
                            >
                              備註
                            </label>
                            <textarea
                              id={`note-${card.id}`}
                              value={cardMeta[card.id]?.note ?? ''}
                              onChange={(e) => onSetCardMeta(card.id, { note: e.target.value })}
                              placeholder="例如：這張是媽媽的卡、記得每月 5 號扣款"
                              rows={2}
                              className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] outline-none placeholder:text-[var(--text-faint)]"
                            />
                          </div>

                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label
                                htmlFor={`fee-${card.id}`}
                                className="mb-1 block text-[11.5px] text-dim"
                              >
                                年費 NT$
                              </label>
                              <input
                                id={`fee-${card.id}`}
                                inputMode="numeric"
                                value={cardMeta[card.id]?.annualFee ?? ''}
                                onChange={(e) =>
                                  onSetCardMeta(card.id, {
                                    annualFee:
                                      Number(e.target.value.replace(/[^0-9]/g, '')) || undefined,
                                  })
                                }
                                placeholder="0"
                                className="num w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] outline-none placeholder:text-[var(--text-faint)]"
                              />
                            </div>
                            <div className="w-24">
                              <label
                                htmlFor={`renewal-${card.id}`}
                                className="mb-1 block text-[11.5px] text-dim"
                              >
                                續卡月
                              </label>
                              <select
                                id={`renewal-${card.id}`}
                                value={cardMeta[card.id]?.renewalMonth ?? ''}
                                onChange={(e) =>
                                  onSetCardMeta(card.id, {
                                    renewalMonth: e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  })
                                }
                                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-[13px] outline-none"
                              >
                                <option value="">－</option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                  <option key={m} value={m}>
                                    {m} 月
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={`waiver-${card.id}`}
                              className="mb-1 block text-[11.5px] text-dim"
                            >
                              免年費條件（文字說明就好）
                            </label>
                            <input
                              id={`waiver-${card.id}`}
                              value={cardMeta[card.id]?.feeWaiverNote ?? ''}
                              onChange={(e) =>
                                onSetCardMeta(card.id, { feeWaiverNote: e.target.value })
                              }
                              placeholder="例如：年刷 6 次或消費滿 3 萬"
                              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] outline-none placeholder:text-[var(--text-faint)]"
                            />
                          </div>

                          {cardMeta[card.id]?.annualFee ? (
                            <p className="text-[11.5px] text-faint">
                              今年已賺回饋 NT$
                              {(annualEarned[card.id]?.year === new Date().getFullYear()
                                ? annualEarned[card.id].total
                                : 0
                              ).toLocaleString('zh-TW')}
                              （靠「記一筆」累積，不用另外輸入）
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {card.custom ? (
                    <div className="mt-1.5 flex gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCard(card);
                          setEditorOpen(true);
                        }}
                        className="tap flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] text-dim"
                      >
                        <Pencil size={12} aria-hidden />
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`要刪除「${card.bank} ${card.name}」嗎？`)) {
                            onRemoveCustomCard(card.id);
                          }
                        }}
                        className="tap flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] text-dim"
                      >
                        <Trash2 size={12} aria-hidden />
                        刪除
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="block rounded-2xl px-4 py-8 text-center text-[13px] text-dim">
                沒有符合「{keyword}」的卡片。找不到就用上面的「新增卡片」自己輸入。
              </li>
            ) : null}
          </ul>

          {/* 備份與還原：沒有帳號系統，換手機靠這段文字 */}
          <section className="block mt-4 rounded-2xl p-3.5">
            <button
              type="button"
              onClick={() => {
                setBackupOpen((v) => !v);
                setBackupMessage(null);
                if (!backupOpen) setBackupText(onExportWallet());
              }}
              className="tap flex w-full items-center justify-between text-left"
            >
              <span>
                <span className="block text-[13px] font-medium">備份 / 換手機</span>
                <span className="mt-0.5 block text-[11.5px] text-dim">
                  把皮夾設定變成一段文字，貼到新手機就還原
                </span>
              </span>
              <ChevronDown
                size={16}
                aria-hidden
                className={`shrink-0 text-[var(--text-faint)] transition-transform ${
                  backupOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {backupOpen ? (
              <div className="mt-3">
                <textarea
                  value={backupText}
                  onChange={(e) => setBackupText(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  aria-label="皮夾備份碼"
                  className="num block-inset w-full resize-none rounded-xl px-3 py-2.5 text-[12px] leading-relaxed outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const code = onExportWallet();
                      setBackupText(code);
                      try {
                        await navigator.clipboard.writeText(code);
                        setBackupMessage('已複製到剪貼簿，貼到記事本或傳給自己保存');
                      } catch {
                        setBackupMessage('複製失敗，請手動全選上面的文字複製');
                      }
                    }}
                    className="tap flex-1 rounded-full border border-[var(--line)] py-2 text-[12.5px] font-medium"
                  >
                    產生並複製
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const result = onImportWallet(backupText);
                      setBackupMessage(result ?? '已還原，卡片與條碼都回來了');
                    }}
                    className="tap flex-1 rounded-full bg-[var(--surface-2)] py-2 text-[12.5px] font-medium"
                  >
                    貼上後還原
                  </button>
                </div>
                {backupMessage ? (
                  <p className="mt-2 text-[11.5px] leading-snug text-dim">{backupMessage}</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <p className="mt-3 px-1 text-center text-[11.5px] text-faint">
            <a href="/privacy.html" target="_blank" rel="noopener" className="underline underline-offset-2">
              隱私權政策
            </a>
            <span className="mx-1.5">·</span>
            <a href="/terms.html" target="_blank" rel="noopener" className="underline underline-offset-2">
              服務條款
            </a>
          </p>
        </div>

        <div className="safe-bottom border-t border-[var(--line)] bg-[var(--bg-soft)] px-5 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="tap flex h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] text-[15px] font-bold text-[var(--accent-ink)]"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
