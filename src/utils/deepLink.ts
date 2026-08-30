import type { DeepLinkResult, PaymentMethodMeta, PaymentMethodType } from '../types';

/**
 * 各支付 App 的 URL Scheme 備援表。
 * rules.json 裡有 scheme 時以資料為主，這裡是保險絲。
 *
 * 註：URL Scheme 沒有官方公開清單，各家改版也不會公告。
 * 空字串代表「我們不確定，別亂跳」——這時 UI 會改成開官網或商店頁，
 * 這比跳出 iOS 的「無法打開網頁」錯誤對使用者友善。
 */
export const FALLBACK_SCHEMES: Record<PaymentMethodType, string> = {
  // 專營電子支付
  // 下面這些是 2026 查證修正過的：原本寫死的 scheme 很多是照 ID 名稱猜的
  // （例如 jkopay:// 這種），跟 App 實際註冊的 scheme 對不起來。
  // 來源是社群整理文件與 iOS 捷徑教學，不是官方文件（各家不會公告這個），
  // 所以還是可能因為 App 改版而失效——這正是 openPaymentApp() 本來就有
  // 逾時備援機制的原因，不是新問題。
  jkopay: 'jkos://showQRCode', // 原本寫 jkopay://，錯的，實際是 jkos://
  ipass_money: 'https://nwww.ipasspay.com.tw/online/mpm/mycode_pay', // 原本寫 ipassmoney://，錯的，實際是 HTTPS 連結不是自訂 scheme
  pxpayplus: 'com.pxpay.plus://zjdja', // 這個 ID 對應「全支付」，原本寫 pxpayplus:// 是错的
  easywallet: 'tw.com.easycard.easycardwallet://paymentCode', // 原本寫 easywallet://，錯的
  pxpay_plus: 'pluspay-pp://payment_code', // 這個 ID 對應「全盈+PAY」，原本空白，查到後補上
  icashpay: 'icashpay://www.icashpay.com.tw/ICP?Action=Mainaction&Event=PayQrCode', // 原本只有裸的 icashpay://，補上正確路徑才會直接跳付款碼
  opay: '',
  gamapay: '',
  simplepay: '',
  linepay: 'line://pay/generateQR', // 原本寫 line://pay，補上正確路徑
  // 銀行與共同平台
  taiwanpay: 'twmpshortcut://?type=payment', // 原本寫 taiwanpay://，錯的
  twqr: '',
  esun_wallet: 'esunwallet://esunbarcode', // 原本空白，查到後補上
  taishin_pay: 'cardaily://?stateName=N000002_001', // 原本空白，查到後補上（Richart 底下的台新 Pay 功能）
  // 通路自家錢包
  px_pay: 'https://iospxpay.page.link/MemberCard', // 全聯 PX Pay 沒有自訂 scheme，是 Firebase 動態連結
  famipay: 'familymart://action.go/pay/barcode', // 原本空白，查到後補上
  // 手機感應：這三個沒有「開啟 App」這回事，2026 年查證過，
  // 蘋果沒有公開任何能跳進 Apple Pay 付款介面的 URL scheme——
  // 「shoebox://」這個坊間偶爾流傳的 scheme，充其量只會打開錢包 App
  // 讓你「看」卡片，不是觸發 NFC 感應付款的雙按側鍵手勢，兩者是不同動作，
  // 所以這裡刻意不用它，避免使用者誤以為打開了 App 就等於完成感應付款。
  // Google Pay 唯一有文件記載的深連結是印度 UPI 生態系專用，跟台灣的
  // NFC 感應付款是兩回事。這裡刻意留空字串，UI 改用「感應付款」的
  // 操作說明，不要假裝有得跳轉。
  apple_pay: '',
  google_pay: '',
  samsung_pay: '',
  // 實體卡片：沒有 App 可開
  easycard: '',
  ipass_card: '',
  physical: '',
};

/** LINE Pay 在部分機型要用 linepay://，這裡準備第二順位 */
const SECONDARY_SCHEMES: Partial<Record<PaymentMethodType, string>> = {
  linepay: 'linepay://',
};

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** 是否已「加入主畫面」以 standalone 模式執行 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/**
 * 手機感應付款的操作說明。這三個沒有「開啟 App」這回事——
 * 查證過 2026 年現況：蘋果沒有公開任何 URL scheme 能跳進 Apple Pay
 * 的付款介面，Google Pay 唯一的深連結文件是印度 UPI 專用，跟台灣的
 * NFC 感應完全不相關。UI 不應該顯示「開啟」按鈕，改用這裡的操作說明。
 */
export const NFC_TAP_GUIDANCE: Partial<Record<PaymentMethodType, string>> = {
  apple_pay: '雙按手機側邊鍵，Face ID／Touch ID 認證後，直接靠近感應機即可，不用打開任何 App。',
  google_pay: '解鎖手機後，直接把手機靠近感應機，不用打開任何 App。',
  samsung_pay: '從螢幕底部往上滑喚出付款畫面，或解鎖後直接靠近感應機。',
};

/** 是否為「手機感應」類支付方式：沒有 App 可以開，操作是靠近感應機而非跳轉 */
export function isNfcTapMethod(id: PaymentMethodType): boolean {
  return id === 'apple_pay' || id === 'google_pay' || id === 'samsung_pay';
}

/**
 * 手機作業系統跟這個手機感應支付方式合不合——
 * Apple Pay 只有 iPhone 能用，Google Pay 只有 Android 能用。
 * 判斷錯誤裝置時，UI 應該直接標示「此裝置無法使用」，不要讓它出現在
 * 並列比較裡佔一個看起來可行的位置。
 */
export function isNfcMethodUnavailableOnThisDevice(id: PaymentMethodType): boolean {
  if (id === 'apple_pay') return isAndroid();
  if (id === 'google_pay') return isIOS();
  return false;
}

export function getScheme(meta: PaymentMethodMeta): string {
  return meta.scheme || FALLBACK_SCHEMES[meta.id] || '';
}

/**
 * 嘗試喚醒支付 App。
 *
 * 瀏覽器沒有任何 API 能直接查詢「App 是否安裝」，
 * 這裡用業界通行做法：跳轉後若頁面仍在前景（沒有被 App 蓋掉），
 * 就視為喚醒失敗，交由呼叫端顯示備援選項。
 *
 * @param meta 支付方式
 * @param onFallback 喚醒失敗時的回呼（例如跳出「沒安裝這個 App？」提示）
 */
export function openPaymentApp(
  meta: PaymentMethodMeta,
  onFallback?: (result: DeepLinkResult) => void,
  timeoutMs = 1600,
): DeepLinkResult {
  const scheme = getScheme(meta);

  if (!scheme) {
    const result: DeepLinkResult = { opened: false, reason: 'no-scheme' };
    onFallback?.(result);
    return result;
  }

  let settled = false;
  const start = Date.now();

  const cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onLeave);
    window.removeEventListener('blur', onLeave);
  };

  const onLeave = () => {
    settled = true;
    cleanup();
  };

  const onVisibilityChange = () => {
    if (document.hidden) onLeave();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onLeave);
  window.addEventListener('blur', onLeave);

  window.setTimeout(() => {
    cleanup();
    // 若中途切換到 App 再切回來，經過時間會明顯大於 timeout，不算失敗
    const elapsed = Date.now() - start;
    if (settled || document.hidden || elapsed > timeoutMs * 2) return;
    onFallback?.({
      opened: false,
      reason: 'timeout',
      fallbackUrl: meta.webFallback || meta.storeUrl || undefined,
    });
  }, timeoutMs);

  try {
    // iOS Safari 在使用者手勢中直接改 location 最穩定
    window.location.href = scheme;

    // LINE Pay 等有第二 scheme 的，短暫延遲後再試一次
    const secondary = SECONDARY_SCHEMES[meta.id];
    if (secondary) {
      window.setTimeout(() => {
        if (!settled && !document.hidden) {
          window.location.href = secondary;
        }
      }, 700);
    }
  } catch {
    cleanup();
    const result: DeepLinkResult = {
      opened: false,
      reason: 'blocked',
      fallbackUrl: meta.webFallback || meta.storeUrl || undefined,
    };
    onFallback?.(result);
    return result;
  }

  return { opened: true };
}

/** 在新分頁開啟外部連結（辦卡導流、App Store 備援） */
export function openExternal(url: string): void {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
