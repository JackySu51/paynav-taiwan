import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { buildCrashReportUrl } from '../utils/issueReport';
import { openExternal } from '../utils/deepLink';

interface ErrorBoundaryProps {
  children: ReactNode;
  dataVersion?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * App 整體的錯誤攔截層。
 *
 * 設計原則：錯誤只在裝置本機處理，不會自動送出任何資料——
 * 這是刻意的，資料不外流是這個 App 的核心承諾（見 SECURITY.md）。
 * 使用者看到這個畫面時，資料還在他的裝置上，什麼都沒有被送出去。
 * 只有使用者自己按下「回報這個問題」，才會把錯誤細節組成一個
 * GitHub issue 網址、打開瀏覽器讓他自己選擇要不要送出——
 * App 本身沒有偷偷連線回報任何東西。
 *
 * 「重新整理」按鈕：因為這是 PWA，localStorage 的資料不會因為重新整理
 * 而消失，皮夾、卡片、記帳這些都還在，可以放心按。
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 只寫進瀏覽器自己的 console，不送出任何地方
    console.error('ErrorBoundary 攔截到錯誤：', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReport = (): void => {
    const { error, errorInfo } = this.state;
    if (!error) return;
    const url = buildCrashReportUrl({
      errorMessage: error.message || String(error),
      errorStack: error.stack,
      componentInfo: errorInfo?.componentStack?.slice(0, 300),
      dataVersion: this.props.dataVersion,
    });
    openExternal(url);
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-app flex flex-col items-center justify-center bg-[var(--bg)] px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-soft)]">
          <AlertTriangle size={28} className="text-[var(--danger)]" aria-hidden />
        </div>

        <h1 className="mb-2 text-[18px] font-semibold">畫面出了點問題</h1>
        <p className="mb-1 max-w-xs text-[14px] text-dim">
          App 遇到未預期的錯誤，先在你的裝置本機攔截下來了。
        </p>
        <p className="mb-6 max-w-xs text-[12.5px] text-faint">
          你的皮夾、卡片、記帳資料都還在，不會因為這個錯誤消失，也沒有任何資料被送出去。
        </p>

        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <button
            type="button"
            onClick={this.handleReload}
            className="tap btn-primary flex h-12 items-center justify-center gap-2 text-[15px]"
          >
            <RefreshCw size={17} aria-hidden />
            重新整理
          </button>

          <button
            type="button"
            onClick={this.handleReport}
            className="tap flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--line)] text-[14px] text-dim"
          >
            <ExternalLink size={16} aria-hidden />
            回報這個問題（會打開 GitHub，由你決定要不要送出）
          </button>
        </div>

        <p className="mt-6 max-w-xs text-[11px] text-faint">{error.message}</p>
      </div>
    );
  }
}
