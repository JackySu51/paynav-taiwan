# 08 · iOS App Store 上架流程

**先決條件（你要自己準備）：**
- Mac 電腦（Xcode 只能在 macOS 跑）
- Apple 開發者帳號（$99/年，需要美國稅表 W-8BEN，走網頁申請約 3-7 天）
- App 圖示的 1024×1024 PNG（已用 `public/pwa-512x512.png` 為基礎，Xcode 會自動產各尺寸）

**還沒申請開發者帳號？** 可以先跳過這份文件，直接把 App 部署到 Cloudflare Pages 就好。使用者在 iPhone Safari 打開網址 → 分享 → 加入主畫面，體驗跟 App 幾乎一樣，圖示、離線、全螢幕都有。上架這件事什麼時候做都可以，先驗證有沒有人用比較重要。

---

## 第一次打包

專案根目錄執行：

```bash
npm install
npm run ios:setup
```

它會做兩件事：

1. `npm run build` 產出 `dist/`
2. `npx cap add ios` 建立 `ios/` 資料夾，裡面是完整的 Xcode 專案

跑完會多出 `ios/App/App.xcworkspace`，這是 Xcode 要打開的檔案。

打開它：

```bash
npm run ios:open
```

## 在 Xcode 裡設定

進 Xcode 之後，左邊點 `App` 專案（藍色圖示），中間切到 **Signing & Capabilities**：

1. **Team** 選你的開發者帳號
2. **Bundle Identifier** 已經是 `com.paynav.taiwan`，需要唯一——如果被佔用改成 `com.你的名字.paynav`
3. **Deployment Target**：iOS 15.0 以上（Capacitor 6 的下限）

切到 **General**：

- **Display Name**：`支付導航`
- **Version**：`1.0.0`（App Store 顯示的版本號）
- **Build**：`1`（每次上傳要加一）

切到 **Info**：加兩個 Privacy 說明（Apple 審核會查）：

- `Privacy - Location When In Use Usage Description`：`用於判斷你目前在哪家店，推薦適合的支付方式`
- `Privacy - Camera Usage Description`：`未來用於掃描實體會員卡條碼加入皮夾`（先寫上，之後功能才不用改）

## 圖示與啟動畫面

Xcode 左邊 → `App/Assets.xcassets/AppIcon` → 把 `public/pwa-512x512.png` 拖進 1024×1024 那格。Xcode 會自動產所有尺寸。

啟動畫面 `Splash` 建議留白（Capacitor 預設就是白底），App 進來很快，看不太到。

## 在模擬器測試

Xcode 頂部裝置選單選 **iPhone 15**（或任一），按左上角 ▶ 執行。

大概 30 秒後 App 會在模擬器裡開起來。**這就是使用者會看到的樣子**——你自己先試一遍：勾卡、看排序、切換分頁、加條碼、全螢幕條碼。

## 在真機測試

用 Lightning 或 USB-C 線接 iPhone，第一次會問「信任這台電腦？」按信任。Xcode 頂部裝置選單會出現你的手機名稱，選它，按 ▶。

第一次在手機上打開會跳「不受信任的開發者」——到手機 **設定 → 一般 → VPN 與裝置管理**，把你的 Apple ID 設為信任。

**真機測試最重要的是 GPS**——這是模擬器測不出來的。走一次真實的通勤路線，看看它有沒有正確跳店。

## 打包並上傳 App Store

Xcode 頂部裝置選單改成 **Any iOS Device (arm64)**，選單 **Product → Archive**（要幾分鐘）。

跑完會跳出 Organizer 視窗，點 **Distribute App** → **App Store Connect** → **Upload** → 一路按下一步。

上傳成功後到 <https://appstoreconnect.apple.com>，選你的 App，會在 TestFlight 看到剛上傳的 build（要等 5-30 分鐘處理完）。

## App Store 上架資料

在 App Store Connect 建立新 App 之後要填的東西：

| 欄位 | 內容建議 |
| --- | --- |
| App 名稱 | `台灣支付導航` |
| 副標題 | `刷哪張卡最划算，走進店裡就知道` |
| 類別 | 主要：財務；次要：實用工具 |
| 隱私權政策網址 | 你的 Cloudflare Pages 域名 + `/privacy` |
| 支援網址 | GitHub repo 或 email |
| 描述 | 見下方範本 |
| 關鍵字 | `信用卡,回饋,行動支付,街口,LINE Pay,悠遊付,全支付,發票條碼` |
| 螢幕截圖 | 6.7 吋（iPhone 15 Pro Max）與 5.5 吋（iPhone 8 Plus）各 3-10 張 |

### 描述範本

```
走進店裡三秒知道刷哪張卡最划算。

台灣二十幾種支付工具、每家銀行每季換活動——這款 App 幫你把當下最划算的組合排出來，不用背也不用查。

・支援 22 種支付工具：街口、LINE Pay、全支付、悠遊付、icash Pay、台灣 Pay、TWQR、Apple Pay 等
・15 張主力信用卡、120 條回饋規則（可自己新增）
・自動偵測便利商店、超商、超市、加油站等 97 個通路
・回饋上限追蹤：上限用完自動改推別張卡
・記帳一筆就會累計本月已用額度
・手機條碼、會員卡、捐贈碼可以存進來一鍵叫出
・支援日本 PayPay 跨境掃碼、韓國 Paybooc/ZeroPay 通路

隱私：
所有資料只存在你的手機，不會上傳。沒有帳號系統，沒有追蹤。

免責聲明：
回饋數字為示範樣本，實際以各發卡銀行公告為準。App 不提供理財建議。
```

## 常見審核退件與解法

| 退件原因 | 對應做法 |
| --- | --- |
| `Guideline 2.1 - Information Needed` | 補全 Privacy Policy 頁面，說明「App 使用 GPS 但不上傳」 |
| `Guideline 3.1.1 - In-App Purchase` | 辦卡連結若被認為是「銷售金融產品」，加一句「跳到銀行官網查看」在按鈕上 |
| `Guideline 4.2 - Minimum Functionality` | 首次審核最常見。把首次引導做好、多加幾個真實通路的推薦截圖 |
| `Guideline 5.1.1 - Data Collection` | 定位權限的說明字串要具體，別寫「用於改善服務」這種空話 |

第一次審核大約 24-48 小時。**建議在週一週二上傳**，週末 Apple 審核速度會變慢。

## 之後的更新流程

專案改完後：

```bash
npm run ios:sync    # 把新內容同步進 iOS 專案
npm run ios:open    # 打開 Xcode
```

在 Xcode 裡把 Build 號 +1（例如 1 → 2），Archive → Upload。上架後就會看到有更新提示。

**內容更新（改回饋數字、加卡）不需要重新審核**：因為那些是動態資料，Cloudflare Pages 部署完 App 打開就會抓最新的。**只有介面或功能改動才要重新上架。**

## 一年後的續約

Apple 開發者帳號 $99/年，到期前 30 天會寄信提醒。**沒續約 App 會下架。** 這是你長期要負擔的成本，換算下來每月約 260 元台幣。

如果你決定不續了，記得先在 App Store Connect 把 App 從商店下架，並在自己網站說明使用者可以改用網頁版（PWA）。
