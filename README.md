# 好付神卡 CardVsPay — MVP 1.0

> 原專案名稱「台灣支付導航 PayNav Taiwan」，2026-08 更名。GitHub repo 與 Cloudflare 專案名稱維持 `paynav-taiwan` 不變（避免搬遷網址與部署設定的技術風險），僅使用者看到的 App 名稱、PWA 顯示名稱更新為新名字。

走進店裡三秒知道刷哪張最划算。100% Client-Side（Local-First）PWA，沒有後端、沒有帳號、沒有資料上傳。
GPS 比對、回饋試算、條碼繪製全部在瀏覽器裡跑；卡片清單與條碼只寫進這台裝置的 `localStorage`。

涵蓋 22 種台灣支付工具（含 9 家專營電支與 TWQR）、15 張卡與電支帳戶、120 條回饋規則、
97 個通路分成 19 類（超商、手搖飲、藥妝、3C、交通、加油、外送、網購…），
使用者還可以自己新增卡片與規則（存在本機），
日本與韓國海外模式，以及 34 個可分區下載的地標包（台灣 22 縣市、日本 7 都市、韓國 5 都市）。

## 完全沒寫過程式？

照著這三份文件做就好，不用先懂原理：

0. [`docs/START-HERE.md`](docs/START-HERE.md) — **先看這份。** 從零到上線的完整流程，含排錯表
1. [`docs/00-第一次上手.md`](docs/00-第一次上手.md) — 從裝 Node.js 到在瀏覽器看到 App
2. [`docs/01-上線部署.md`](docs/01-上線部署.md) — GitHub + Cloudflare Pages，之後改東西自動上線
3. [`docs/02-自動更新機制.md`](docs/02-自動更新機制.md) — R2 熱更新、GitHub Actions 定時檢查

想知道接下來做什麼、或某個設計為什麼長這樣：

4. [`docs/03-功能藍圖.md`](docs/03-功能藍圖.md) — 該加什麼、刻意不加什麼，以及 LOGO 設計說明
5. [`docs/04-優惠監控.md`](docs/04-優惠監控.md) — 為什麼是變動偵測而不是爬蟲
6. [`docs/05-日韓海外模式.md`](docs/05-日韓海外模式.md) — 日本 PayPay、韓國 Paybooc／ZeroPay 兩條網路
7. [`docs/06-地標包.md`](docs/06-地標包.md) — 分區下載地標、如何產製完整圖資、付費解鎖設計
8. [`docs/07-商業性評估.md`](docs/07-商業性評估.md) — 變現路線、天花板與風險
9. [`docs/08-iOS-上架.md`](docs/08-iOS-上架.md) — 用 Capacitor 打包上架 App Store 的完整流程
10. [`docs/09-資安文件維護規則.md`](docs/09-資安文件維護規則.md) — SECURITY.md／.env.example 什麼時候要一起改

## 快速開始

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # 型別檢查
npm run build      # 產出 dist/
npm run preview    # 本機預覽 production build（含 Service Worker）
npm run check:rules   # 檢查回饋規則有沒有打錯或過期
npm run promo:watch   # 檢查官方優惠頁有沒有變動
npm run packs:list    # 看地標包清單與狀態
npm run packs:build -- tw-taipei   # 從 OpenStreetMap 產製台北市的門市資料
```

> 定位與 Service Worker 需要 HTTPS 或 localhost。手機實測時用 `npm run dev -- --host` 搭配區網 HTTPS 通道（如 Cloudflare Tunnel）才拿得到 GPS。

## 技術選型

| 面向 | 選擇 |
| --- | --- |
| 框架 | React 19 + TypeScript + Vite 6 |
| 樣式 | Tailwind CSS 3（設計代幣走 CSS 變數，跟隨系統深／淺色） |
| 圖示 | lucide-react |
| PWA | vite-plugin-pwa（`display: standalone`、Workbox 預快取、Apple Touch Icon） |
| 狀態 | zustand + persist middleware（localStorage） |
| 條碼 | jsbarcode（CODE39 / CODE128） |
| 部署 | Cloudflare Pages 靜態託管 |
| 資料託管 | Cloudflare R2（選用，可熱更新規則庫） |
| 定時任務 | Cloudflare Workers Cron + GitHub Actions |
| 地區支援 | 台灣 / 日本 / 韓國（`region` 欄位，引擎會擋掉跨國誤判） |
| 地標圖資 | OpenStreetMap（ODbL），分區下載後存 IndexedDB |

## 架構與安全性

**現在：完全 local-first，沒有伺服器、沒有帳號、沒有第三方能看到你的資料。** 卡片清單、自訂規則、條碼、記帳紀錄，全部只寫進使用者自己裝置的 `localStorage` / `IndexedDB`，這個 App 沒有後端資料庫，沒有任何地方能收集使用者的個人資料——這不只是省成本，也是刻意的隱私設計：不收集的資料，永遠不會外洩。

**規劃中：加入 Turso（資料庫）+ Supabase Auth（登入）之後，架構會是這樣：**

```
使用者裝置 → Cloudflare Worker（唯一能碰資料庫的地方，驗證身分＋檢查資料歸屬）→ Turso
```

使用者裝置**永遠不會直接連 Turso**，所有查詢都要先經過 Cloudflare Worker 驗證身分並確認資料歸屬。這跟「前端直接拿公開金鑰查資料庫、靠資料庫政策擋權限」的做法不同——那類做法一旦資料庫政策設錯就直接被繞過，是 2026 年多起 AI 生成應用資安事件的根因。我們的做法是「前端連都連不到資料庫」，把授權檢查寫在可以被審查、測試的程式碼裡，而不是容易漏設的資料庫政策裡。

登入不到功能未開放前，訪客模式永遠是完整可用的——登入只是加分的跨裝置同步，不是必要條件。

詳細的資安檢查清單、威脅模型、回報管道見 [`SECURITY.md`](SECURITY.md)；環境變數規劃見 [`.env.example`](.env.example)。**這三份文件會跟著功能增加持續更新，不是寫一次就不動的靜態文件。**

## 目錄結構

```text
paynav-taiwan/
├── public/
│   ├── favicon.svg / apple-touch-icon.png / pwa-192x192.png / pwa-512x512.png
│   └── data/
│       ├── rules.json      # 支付方式 meta + 信用卡回饋規則庫
│       └── stores.json     # 通路清單 + 門市座標
├── src/
│   ├── components/         # Layout / BarcodeCard / StoreDetector / PaymentRankCard
│   │                       # AffiliatePromoCard / CardSelectorModal
│   ├── types/index.ts      # 全域型別，同時是 JSON 的 schema 契約
│   ├── utils/
│   │   ├── geo.ts          # Haversine 距離、最近門市比對、定位包裝
│   │   ├── rewardEngine.ts # 複合回饋試算與排序、辦卡導流挑選
│   │   ├── deepLink.ts     # URL Scheme 喚醒與備援
│   │   └── icons.tsx       # iconName → lucide 元件對照
│   ├── store/useAppStore.ts
│   ├── App.tsx / main.tsx / index.css
└── vite.config.ts / tailwind.config.js / tsconfig*.json
```

`manifest.webmanifest` 由 vite-plugin-pwa 於 build 時產生在 `dist/`，設定寫在 `vite.config.ts` 的 `manifest` 區塊，不需要在 `public/` 另外放一份（放了會互相覆蓋）。

## 核心邏輯

**離線 GPS 比對** — `getNearestStore(userLat, userLon, stores)` 以 Haversine 公式算球面距離，預設 100 公尺內才算命中；沒命中就 fallback 成 `general`（一般通路），使用者可在頂部下拉手動指定。手動指定後 GPS 不會覆寫，直到按下「重新定位」或選「交還給定位自動判斷」。

**複合回饋試算** — `calculateRewards()` 遍歷持有卡片的每條規則，命中條件是 `channels` 含當前通路 id 或 `all`；總回饋率 = `base_reward_pct + extra_reward_pct`；依支付方式分組取最高（同回饋率時優先「通路專屬規則」，再比每月上限），最後降序排序，第一名標 `isBest`。

**辦卡導流** — 同一套引擎跑一次「使用者沒有的卡」，取該通路最高回饋且有 `apply_url` 的一張；只有在比使用者目前最佳高出 3 個百分點以上時才顯示橫幅（門檻在 `DEFAULT_AFFILIATE_GAP_PCT`）。

**Deep Link** — 瀏覽器沒有 API 能查 App 是否安裝，這裡用通行做法：跳轉後若頁面仍在前景就視為失敗，卡片內就地展開備援（官網 / 下載連結），不會跳出突兀的 alert。

## 資料來源優先順序

App 讀資料的順序是 **R2/CDN（`VITE_DATA_BASE_URL`）→ 內建的 `public/data/`**。
沒設定 R2、R2 掛掉、使用者離線，都會自動退回內建那份，畫面不會壞。
所以更新回饋規則只要把新 JSON 丟上 R2，使用者不用更新 App。

## 維護資料

兩份 JSON 是這個 App 的全部知識，改完重新部署即可，不用動程式碼。

- `rules.json`：新增卡片就往 `cards` 加一筆，`rules[].payment_method` 必須是 `PaymentMethodType` 之一；`cap_amount_monthly` 用 `null` 表示無上限；`is_affiliate_highlight` 標主打神卡。
- `stores.json`：`stores[].id` 是**通路代號**（會被規則的 `channels` 比對），同一通路的多間分店共用同一個 id，用 `uid` 當唯一鍵、`branch` 放分店名。`channels` 是手動下拉選單的來源。

**回饋數字為示範樣本。** 各家銀行活動每季調整、多數加碼需要登錄與門檻，正式上線前請以發卡銀行公告校正，並在畫面上保留免責說明。門市座標同樣是示範點位，建議改接政府開放資料或各通路官方門市 API 產製。

## 部署到 Cloudflare Pages

- **Build command**：`npm run build`
- **Build output directory**：`dist`
- **Node version**：18 以上

或用 Wrangler 直接推：

```bash
npm run build
npx wrangler pages deploy dist --project-name paynav-taiwan
```

Cloudflare Pages 預設就是 HTTPS，定位與 Service Worker 可直接運作。iPhone 用 Safari 開啟後按分享 →「加入主畫面」，之後啟動即為全螢幕 standalone 模式，離線也能叫出條碼與回饋排序。

## 常用指令

```bash
npm run dev            # 本機開發
npm run check:rules    # 檢查回饋規則有沒有打錯字或過期
npm run build          # 打包
```

## 已知邊界

- iOS 對未安裝的 App scheme 可能跳出系統提示，這是平台行為，無法從網頁端攔截。
- Apple Pay 沒有公開的喚醒 scheme，卡片會引導使用者直接感應或打開錢包。
- 回饋試算不處理「當月已用掉多少上限」，因為那需要記帳資料；`estimateCashback()` 已預留單筆換算入口。
