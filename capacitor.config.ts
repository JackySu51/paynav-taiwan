/// <reference types="node" />
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor：把這個 PWA 包成 iOS App。
 *
 * 使用方式（第一次）：
 *   npm install -D @capacitor/cli @capacitor/core @capacitor/ios
 *   npm run build
 *   npx cap add ios
 *   npx cap open ios
 *
 * 之後每次更新內容：
 *   npm run build && npx cap sync ios
 *
 * 完整流程與上架步驟見 docs/08-iOS-上架.md
 */
const config: CapacitorConfig = {
  appId: 'com.paynav.taiwan',
  appName: '台灣支付導航',
  webDir: 'dist',
  ios: {
    // iOS 內建的內容顯示區塊高度扣掉狀態列與 home indicator
    contentInset: 'automatic',
    // 加入主畫面時保持 HTTPS 樣式
    scheme: 'PayNavTW',
    // 允許讀取相機（未來若做掃碼加卡會用到）
    limitsNavigationsToAppBoundDomains: false,
  },
  // App 內開外部 App（街口、全支付）走 Capacitor App plugin
  server: {
    androidScheme: 'https',
  },
};

export default config;
