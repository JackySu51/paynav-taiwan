import type { CalculatedRewardResult, CreditCard, PaymentMethodMeta, StorePOI } from '../types';

/**
 * 產生一個可以打開 GitHub issue 表單、且欄位都預先填好的網址。
 *
 * 為什麼這樣做：使用者發現規則錯誤時，最痛的一步是「要複製哪些資訊」。
 * 這裡把 App 已知的所有欄位（卡片、支付、通路、目前顯示的數字、版本）
 * 都塞進 URL 的 query，開啟表單時 GitHub 自動填好，
 * 使用者只需要輸入「正確的數字是多少」就能送出。
 *
 * GitHub Issue Form 的欄位對照：
 *   - 使用表單裡定義的 id（不是 label），例如 ?card=xxx&channel=xxx
 *   - labels 用逗號分隔的字串
 *   - template 就是檔名（不含副檔名）
 */

const REPO_URL = 'https://github.com/JackySu51/paynav-taiwan';

interface BuildRuleReportUrlParams {
  card: CreditCard;
  paymentMethod: PaymentMethodMeta;
  channel: StorePOI;
  result: CalculatedRewardResult;
  dataVersion: string;
  appVersion?: string;
}

export function buildRuleReportUrl({
  card,
  paymentMethod,
  channel,
  result,
  dataVersion,
  appVersion = '1.0.0',
}: BuildRuleReportUrlParams): string {
  const current = formatCurrentReward(result);

  const env = JSON.stringify({
    appVersion,
    dataVersion,
    cardId: card.id,
    paymentMethodId: paymentMethod.id,
    channelId: channel.id,
    region: channel.region ?? 'TW',
    reportedAt: new Date().toISOString(),
  });

  const params = new URLSearchParams({
    template: 'rule-report.yml',
    title: `[規則回報] ${card.bank} ${card.name} × ${paymentMethod.name}`,
    labels: 'rule-report,needs-triage',
    card: `${card.bank} ${card.name}`,
    'payment_method': `${paymentMethod.name} ${paymentMethod.id}`,
    channel: `${channel.name}${channel.branch ? ` ${channel.branch}` : ''}`,
    current,
    env,
  });

  return `${REPO_URL}/issues/new?${params.toString()}`;
}

interface BuildCrashReportUrlParams {
  errorMessage: string;
  errorStack?: string;
  componentInfo?: string;
  dataVersion?: string;
  appVersion?: string;
}

/**
 * 產生一個預填好錯誤細節的 GitHub issue 網址，給 ErrorBoundary 的
 * 「回報這個問題」按鈕用。跟 buildRuleReportUrl 是同一套邏輯：
 * 使用者按下去才會開啟這個網址、才會把資料送出去，App 不會自動偷偷回報，
 * 符合 local-first、資料不外流的定位。
 */
export function buildCrashReportUrl({
  errorMessage,
  errorStack,
  componentInfo,
  dataVersion = '未知',
  appVersion = '1.0.0',
}: BuildCrashReportUrlParams): string {
  const env = JSON.stringify({
    appVersion,
    dataVersion,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '未知',
    reportedAt: new Date().toISOString(),
  });

  const errorDetail = [
    `錯誤訊息：${errorMessage}`,
    componentInfo ? `\n發生位置：${componentInfo}` : '',
    errorStack ? `\n\n\`\`\`\n${errorStack.slice(0, 1500)}\n\`\`\`` : '',
  ].join('');

  const params = new URLSearchParams({
    template: 'crash-report.yml',
    title: `[錯誤回報] ${errorMessage.slice(0, 80)}`,
    labels: 'bug-report,needs-triage',
    error_detail: errorDetail,
    env,
  });

  return `${REPO_URL}/issues/new?${params.toString()}`;
}

function formatCurrentReward(result: CalculatedRewardResult): string {
  const parts: string[] = [];
  parts.push(`基本 ${result.baseRewardPct}%`);
  if (result.extraRewardPct > 0) {
    parts.push(`+ 加碼 ${result.extraRewardPct}%`);
  }
  if (result.capMonthly !== null) {
    parts.push(`，每月上限 NT$${result.capMonthly}`);
  } else {
    parts.push('，無上限');
  }
  if (result.validUntil) {
    parts.push(`，活動至 ${result.validUntil}`);
  }
  return parts.join('');
}

/**
 * 產生「回報 App bug」的網址；bug 表單還沒建好，先開空白 issue 頁。
 * 之後補 bug-report.yml 再切過去。
 */
export function buildBugReportUrl(): string {
  return `${REPO_URL}/issues/new?labels=bug&title=%5B%E5%9B%9E%E5%A0%B1%5D+`;
}
