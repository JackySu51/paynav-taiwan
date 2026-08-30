import type { ReactNode } from 'react';
import { MapPin, ScanLine, Sparkles, Wallet } from 'lucide-react';

export type TabKey = 'pay' | 'carrier' | 'packs' | 'wallet';

interface LayoutProps {
  children: ReactNode;
  /** 頂部的通路偵測列 */
  header: ReactNode;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onOpenWallet: () => void;
  ownedCount: number;
  dataVersion: string;
  /** 有沒有設定條碼載具，決定頂部按鈕點下去是開全螢幕還是導去新增 */
  hasCarrier: boolean;
  onOpenBarcode: () => void;
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof Wallet }> = [
  { key: 'pay', label: '刷哪張', icon: Sparkles },
  { key: 'carrier', label: '載具', icon: ScanLine },
  { key: 'packs', label: '地標', icon: MapPin },
  { key: 'wallet', label: '皮夾', icon: Wallet },
];

/**
 * 玻璃材質只用在這個檔案裡的兩個地方：頂部浮動標頭、底部浮動分頁列。
 * 兩者都是導覽層，符合規則。畫面主體內容（App.tsx 裡的推薦卡片）
 * 完全不套用玻璃，維持不透明實色——這條界線不要因為方便就打破。
 */
export default function Layout({
  children,
  header,
  activeTab,
  onTabChange,
  onOpenWallet,
  ownedCount,
  dataVersion,
  hasCarrier,
  onOpenBarcode,
}: LayoutProps) {
  return (
    <div
      className="min-h-app relative text-[var(--text)]"
      style={{
        background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-soft) 55%, var(--surface) 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* 頂部浮動標頭：懸浮，不貼齊螢幕邊緣，才有「漂浮在內容之上」的玻璃感 */}
      <header className="safe-top sticky top-3 z-30 mx-auto w-full max-w-lg px-4">
        <div className="glass rounded-[20px] px-1">
          <div className="flex items-center justify-between gap-2 px-3 py-3">
            <div className="min-w-0 leading-none">
              <div className="eyebrow">好付神卡</div>
              <div className="mt-1 truncate text-[17px] font-semibold tracking-tight">
                CardVsPay
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenBarcode}
                className="tap flex h-10 items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-white/40 px-3"
                aria-label={hasCarrier ? '開啟全螢幕條碼' : '新增條碼'}
                title={hasCarrier ? '結帳出示條碼' : '還沒設定條碼，點一下新增'}
              >
                <ScanLine
                  size={16}
                  className={hasCarrier ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]'}
                  aria-hidden
                />
              </button>

              <button
                type="button"
                onClick={onOpenWallet}
                className="tap flex h-10 items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-white/40 px-3"
                aria-label="開啟我的皮夾"
              >
                <Wallet size={16} className="text-[var(--accent)]" aria-hidden />
                <span className="num text-[14px] font-bold">{ownedCount}</span>
              </button>
            </div>
          </div>

          <div className="border-t border-[var(--glass-border)] px-3.5 pb-3.5 pt-3">{header}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pb-6 pt-4">{children}</main>

      <footer className="mx-auto mb-32 w-full max-w-lg px-4">
        <p className="text-[11px] leading-relaxed text-faint">
          規則庫版本 {dataVersion || '—'}．所有資料只存在這台裝置，不會上傳。
          回饋數字為示範樣本，實際以各發卡銀行公告為準。
        </p>
      </footer>

      {/* 底部浮動分頁列：同樣懸浮，不貼齊邊緣，跟頂部標頭呼應 */}
      <nav className="safe-bottom fixed inset-x-0 bottom-3 z-30 mx-auto w-full max-w-lg px-4">
        <div className="glass rounded-full">
          <div className="flex items-stretch px-2 py-2">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = key === activeTab;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTabChange(key)}
                  aria-current={active ? 'page' : undefined}
                  className="tap flex flex-1 flex-col items-center gap-1 rounded-full py-1.5"
                >
                  <Icon
                    size={20}
                    aria-hidden
                    className={active ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]'}
                  />
                  <span
                    className={`text-[10.5px] font-semibold ${
                      active ? 'text-[var(--text)]' : 'text-[var(--text-faint)]'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
