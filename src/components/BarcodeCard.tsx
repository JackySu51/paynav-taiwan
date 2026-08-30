import { useCallback, useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Check, Maximize2, Pencil, Plus, ScanLine, Trash2, X } from 'lucide-react';
import type { BarcodeFormat, CarrierItem, CarrierKind } from '../types';
import {
  CARRIER_KIND_ORDER,
  CARRIER_SPECS,
  MEMBER_PRESETS,
  normalizeCarrierValue,
  validateCarrier,
} from '../utils/carriers';

export { isValidCarrier } from '../utils/carriers';

interface BarcodeCardProps {
  carriers: CarrierItem[];
  activeCarrier: CarrierItem | null;
  onSelect: (id: string) => void;
  onAdd: (kind: CarrierKind, value: string, label?: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<CarrierItem, 'id'>>) => void;
  /** 精簡模式：只顯示條碼與切換列，不顯示新增表單 */
  compact?: boolean;
  /**
   * 無頭模式：平常完全不渲染任何可見內容，只在 openSignal 觸發全螢幕時
   * 顯示條碼疊層。給頂部標頭的常駐按鈕用——那個按鈕不管使用者在哪個
   * 分頁都要能叫出條碼，但畫面上不該多一張看得到的卡片佔位置。
   */
  headless?: boolean;
  /**
   * 外部觸發全螢幕條碼：每次數字改變就開啟一次全螢幕。
   * 用來讓頂部標頭的常駐條碼按鈕可以直接叫出全螢幕，
   * 不用先切到「載具」分頁才找得到。
   */
  openSignal?: number;
}

interface BarcodeSvgProps {
  value: string;
  format: BarcodeFormat;
  height: number;
  lineColor: string;
  background: string;
  fontSize?: number;
  className?: string;
}

function BarcodeSvg({
  value,
  format,
  height,
  lineColor,
  background,
  fontSize = 16,
  className,
}: BarcodeSvgProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format,
        height,
        width: 2.2,
        margin: 8,
        displayValue: true,
        text: value,
        fontOptions: 'bold',
        fontSize,
        textMargin: 6,
        lineColor,
        background,
      });
      setError(null);
    } catch {
      setError('這組內容無法產生條碼，換成 CODE128 再試一次');
    }
  }, [value, format, height, lineColor, background, fontSize]);

  if (error) {
    return <p className="py-6 text-center text-[13px] text-[var(--danger)]">{error}</p>;
  }

  return <svg ref={ref} className={className} role="img" aria-label={`條碼 ${value}`} />;
}

/** 新增條碼的表單：可以自訂名稱，會員卡有常見通路快選 */
function CarrierForm({
  onAdd,
  onCancel,
}: {
  onAdd: (kind: CarrierKind, value: string, label?: string) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<CarrierKind>('mobile');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const spec = CARRIER_SPECS[kind];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const normalized = normalizeCarrierValue(kind, value);
  const error = value ? validateCarrier(kind, normalized) : null;
  const ready = value.length > 0 && !error;

  const submit = () => {
    if (!ready) return;
    onAdd(kind, normalized, label.trim() || undefined);
    setValue('');
    setLabel('');
  };

  return (
    <div>
      <div className="scroll-x -mx-1 flex gap-1.5 px-1 pb-2.5">
        {CARRIER_KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setValue('');
              setLabel('');
            }}
            className={`tap shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] ${
              k === kind
                ? 'border-[var(--accent)] bg-[var(--surface-2)] font-medium'
                : 'border-[var(--line)] text-dim'
            }`}
          >
            {CARRIER_SPECS[k].label}
          </button>
        ))}
      </div>

      {/* 會員卡：常見通路一鍵填名稱 */}
      {kind === 'member' ? (
        <div className="scroll-x -mx-1 mb-2.5 flex gap-1.5 px-1">
          {MEMBER_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setLabel(preset)}
              className={`tap shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] ${
                label === preset
                  ? 'border-[var(--accent)] bg-[var(--surface-2)] font-medium'
                  : 'border-[var(--line)] text-dim'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value.slice(0, 16))}
        placeholder={`名稱（選填，預設「${spec.label}」）`}
        aria-label="條碼名稱"
        className="block-inset mb-2 w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none placeholder:text-[var(--text-faint)]"
      />

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 48))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={spec.placeholder}
          autoCapitalize={kind === 'member' || kind === 'custom' ? 'off' : 'characters'}
          autoCorrect="off"
          spellCheck={false}
          aria-label={spec.label}
          className="num block-inset min-w-0 flex-1 rounded-xl px-3.5 py-3 text-[17px] tracking-[0.1em] outline-none placeholder:text-[var(--text-faint)]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          aria-label="儲存條碼"
          className="tap flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] disabled:opacity-35"
        >
          <Check size={20} aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <p className={`text-[11.5px] ${error ? 'text-[var(--danger)]' : 'text-faint'}`}>
          {error ?? spec.hint}
        </p>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="tap shrink-0 text-[12px] text-dim underline underline-offset-4"
          >
            取消
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function BarcodeCard({
  carriers,
  activeCarrier,
  onSelect,
  onAdd,
  onRemove,
  onUpdate,
  compact = false,
  headless = false,
  openSignal,
}: BarcodeCardProps) {
  const [adding, setAdding] = useState(false);
  const [popup, setPopup] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');

  const current = activeCarrier;

  // 外部觸發（頂部標頭按鈕）：signal 一變就先彈出視窗（變亮＋放大），
  // 不直接全螢幕——讓使用者自己決定要不要再進一步全螢幕
  useEffect(() => {
    if (openSignal !== undefined && openSignal > 0 && current) {
      setPopup(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  // 全螢幕掃描模式：鎖捲動 + 盡力申請螢幕恆亮
  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let sentinel: { release: () => Promise<void> } | null = null;
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      }
    ).wakeLock;

    wakeLock
      ?.request('screen')
      .then((lock) => {
        sentinel = lock;
      })
      .catch(() => undefined);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      void sentinel?.release().catch(() => undefined);
    };
  }, [fullscreen]);

  // 切換條碼時取消改名，否則 onBlur 會把名稱寫到剛切過去的那一組
  useEffect(() => {
    setRenaming(false);
  }, [current?.id]);

  const handleAdd = useCallback(
    (kind: CarrierKind, value: string, label?: string) => {
      onAdd(kind, value, label);
      setAdding(false);
    },
    [onAdd],
  );

  /* ---------------- 還沒有任何條碼 ---------------- */
  if (!current) {
    if (headless) return null;
    return (
      <section className="block rounded-2xl p-4 ">
        <div className="flex items-center gap-2">
          <ScanLine size={17} className="text-[var(--accent)]" aria-hidden />
          <h2 className="text-[15px] font-semibold">加一組常用條碼</h2>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
          手機條碼、捐贈碼、通路會員條碼都可以手動輸入，結帳時直接叫出來讓店員掃。
          內容只存在這台裝置，不會上傳。
        </p>
        <div className="mt-3">
          <CarrierForm onAdd={handleAdd} />
        </div>
      </section>
    );
  }

  /* ---------------- 已有條碼 ---------------- */
  return (
    <>
      {!headless ? (
      <section className="block overflow-hidden rounded-2xl ">
        {/* 多組條碼的切換列 */}
        {carriers.length > 1 || !compact ? (
          <div className="scroll-x flex items-center gap-1.5 px-3 pt-3">
            {carriers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={`tap shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] ${
                  c.id === current.id
                    ? 'border-[var(--accent)] bg-[var(--surface-2)] font-medium'
                    : 'border-[var(--line)] text-dim'
                }`}
              >
                {c.label}
              </button>
            ))}
            {!compact ? (
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                aria-label="新增條碼"
                className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text-faint)]"
              >
                <Plus size={15} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <ScanLine size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
            {renaming ? (
              <input
                autoFocus
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value.slice(0, 16))}
                onBlur={() => {
                  const next = draftLabel.trim();
                  if (next) onUpdate(current.id, { label: next });
                  setRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                aria-label="修改名稱"
                className="block-inset min-w-0 flex-1 rounded-lg px-2 py-1 text-[13px] outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraftLabel(current.label);
                  setRenaming(true);
                }}
                className="tap flex min-w-0 items-center gap-1 text-left"
              >
                <span className="truncate text-[13px] font-medium text-dim">{current.label}</span>
                <Pencil size={12} className="shrink-0 text-[var(--text-faint)]" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onUpdate(current.id, {
                  format: current.format === 'CODE39' ? 'CODE128' : 'CODE39',
                })
              }
              className="tap num rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-dim"
              aria-label="切換條碼格式"
            >
              {current.format}
            </button>
            {!compact ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`要刪除「${current.label}」嗎？`)) onRemove(current.id);
                }}
                className="tap flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-faint)]"
                aria-label="刪除這組條碼"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPopup(true)}
          className="tap block w-full px-3 pb-3 pt-2"
          aria-label="放大條碼給店員掃描"
        >
          <div className="rounded-xl bg-white px-2 py-3">
            <BarcodeSvg
              value={current.value}
              format={current.format}
              height={78}
              lineColor="#000000"
              background="#ffffff"
              className="mx-auto h-auto w-full max-w-[320px]"
            />
          </div>
          <span className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-dim">
            <Maximize2 size={13} aria-hidden />
            點一下放大並調亮
          </span>
        </button>

        {adding ? (
          <div className="border-t border-[var(--line)] px-4 py-3.5">
            <CarrierForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
          </div>
        ) : null}
      </section>
      ) : null}

      {popup && !fullscreen ? (
        <div
          className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-black/45 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="條碼放大"
          onClick={() => setPopup(false)}
        >
          <div
            className="w-full max-w-sm rounded-[28px] bg-white p-5 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-black/60">{current.label}</span>
              <button
                type="button"
                onClick={() => setPopup(false)}
                className="tap flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-black"
                aria-label="關閉"
              >
                <X size={17} aria-hidden />
              </button>
            </div>

            <div className="mt-3 rounded-2xl bg-white px-2 py-4">
              <BarcodeSvg
                value={current.value}
                format={current.format}
                height={92}
                lineColor="#000000"
                background="#ffffff"
                className="mx-auto h-auto w-full"
              />
            </div>

            {carriers.length > 1 ? (
              <div className="mt-3 flex justify-center gap-1.5 overflow-x-auto">
                {carriers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`tap shrink-0 rounded-full border px-3 py-1.5 text-[12px] ${
                      c.id === current.id
                        ? 'border-black/40 bg-black/5 font-medium text-black'
                        : 'border-black/15 text-black/50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setPopup(false);
                setFullscreen(true);
              }}
              className="tap btn-primary mt-4 flex h-12 w-full items-center justify-center gap-2 text-[15px]"
            >
              <Maximize2 size={17} aria-hidden />
              轉全螢幕，橫向給店員掃
            </button>
          </div>
        </div>
      ) : null}

      {fullscreen ? (
        <div
          className="fixed inset-0 z-50 flex animate-fadeIn flex-col items-center justify-center bg-white"
          role="dialog"
          aria-modal="true"
          aria-label="全螢幕條碼"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreen(false);
            }}
            className="absolute right-4 top-[max(env(safe-area-inset-top),16px)] flex h-11 w-11 items-center justify-center rounded-full bg-black/5 text-black"
            aria-label="關閉全螢幕條碼"
          >
            <X size={22} aria-hidden />
          </button>

          <span className="absolute left-4 top-[max(env(safe-area-inset-top),22px)] text-[13px] font-medium text-black/60">
            {current.label}
          </span>

          {/* 橫向放大：手機直握時條碼最長，掃描槍最好對焦 */}
          <div className="rotate-90">
            <BarcodeSvg
              value={current.value}
              format={current.format}
              height={150}
              fontSize={22}
              lineColor="#000000"
              background="#ffffff"
              className="h-auto w-[78vh] max-w-[560px]"
            />
          </div>

          {carriers.length > 1 ? (
            <div
              className="absolute bottom-[max(env(safe-area-inset-bottom),56px)] flex max-w-[92vw] gap-1.5 overflow-x-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {carriers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={`tap shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] ${
                    c.id === current.id
                      ? 'border-black/40 bg-black/5 font-medium text-black'
                      : 'border-black/15 text-black/50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}

          <p className="absolute bottom-[max(env(safe-area-inset-bottom),24px)] text-[13px] text-black/45">
            點畫面任一處關閉
          </p>
        </div>
      ) : null}
    </>
  );
}
