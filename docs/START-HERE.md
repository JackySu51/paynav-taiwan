# START HERE — 從頭到尾的完整流程

**這是唯一有效的指引，其他文件都是細節補充。**

如果你之前試過但卡住了，直接照這份從第 0 節做一次，不會有殘留問題。

---

## 第 0 節：先確認你現在在哪一步

打開終端機（`⌘ + 空白鍵` → 輸入「終端機」），依序貼這三行，每行按 Enter，把結果對照下表：

```bash
git --version
ls -d ~/.git
ls -d ~/Downloads/paynav-taiwan
```

| 第一行結果 | 第二行結果 | 第三行結果 | 你該從哪開始 |
| --- | --- | --- | --- |
| 沒有版本號 / 跳出安裝視窗 | — | — | **步驟 1** |
| 有版本號 | 顯示 `/Users/你/.git` | — | **步驟 2**（要先清掉誤建的 git） |
| 有版本號 | `No such file` | `No such file` | **步驟 3** |
| 有版本號 | `No such file` | 有顯示路徑 | **步驟 4** |

---

## 步驟 1：安裝 git（只要做一次）

新的 Mac 預設沒有 git。

```bash
xcode-select --install
```

會跳出視窗，按「安裝」，等 5–10 分鐘。裝完確認：

```bash
git --version
```

看到 `git version 2.x.x` 就好了。

---

## 步驟 2：清掉誤建在家目錄的 git

前面有一次 `cd` 打錯（`Download` 少了 s），導致 `git init` 建在你的家目錄 `/Users/jackysu`，`git add .` 開始掃你整個系統，出現一堆 `Library/...: Operation not permitted` 的警告。

先按 `control + C` 中斷任何還在跑的指令，然後：

```bash
ls -d ~/.git
rm -rf ~/.git
cd ~ && git status
```

最後一行應該顯示 `fatal: not a git repository`——**這就是我們要的結果**，代表家目錄乾淨了。

> `rm -rf ~/.git` 只刪掉 git 剛剛建立的隱藏追蹤資料夾，不會動到你的任何檔案、文件或照片。請原樣複製，不要自己改路徑。

---

## 步驟 3：安裝專案

需要 Node.js。先確認：

```bash
node -v
```

沒有版本號的話，到 <https://nodejs.org> 下載 **LTS** 版（macOS Installer `.pkg`），裝完重開終端機。

接著把 `paynav-reset-install.sh` 放在「下載」資料夾，執行：

```bash
cd ~/Downloads && bash paynav-reset-install.sh
```

如果之前裝過，它會問你要不要把舊的改名保留，選 `y` 就會保留成 `paynav-taiwan-old-日期`，不會刪掉任何東西。

跑完會印出專案位置。然後：

```bash
cd ~/Downloads/paynav-taiwan && npm install
```

`npm install` 要一兩分鐘。完成後啟動：

```bash
npm run dev
```

終端機會印出 `http://localhost:5173/`，貼到瀏覽器就看得到畫面。**終端機會停在那裡不動，那是正常的**（它在跑伺服器）。要停止按 `control + C`。

**先確認三件事再往下：**

1. 點右上角「0 張卡」→ 勾幾張你有的卡 → 按「完成」，主畫面應該跑出排序
2. 底部點「地標」分頁，最上面有「定位狀態」面板，按「測試定位」
3. 底部點「載具」分頁，輸入 `/AB1234+`，條碼應該畫得出來

### 關於定位（GPS）怎麼確認

「地標」分頁最上面的定位狀態面板會直接告訴你答案：

| 狀態顯示 | 意思 |
| --- | --- |
| 定位成功 + 有座標 | **GPS 正常**，就算下面寫「100 公尺內沒有收錄的門市」也是正常的（示範資料只有 56 個點） |
| 定位權限被拒絕 | 到「系統設定 → 隱私權與安全性 → 定位服務」確認瀏覽器有打勾 |
| 定位失敗 | 通常是 Mac 沒開定位服務，或用了 `http://` 而不是 `localhost` |

**重點：在電腦上用 `localhost` 測，定位是可以運作的**（瀏覽器把 localhost 當安全來源）。但 Mac 的定位靠 Wi-Fi 基地台推算，誤差可能上百公尺，所以「走進店裡自動判斷」這件事要等部署到手機上才測得準。

現階段要驗證通路切換是否正常，用頂部通路徽章手動選就好——那條路徑不需要 GPS。

---

## 步驟 4：推上 GitHub

**這一步跟之前的寫法不同，改用 `&&` 串接。** 原因：`&&` 的意思是「前一個成功才做下一個」，任何一步失敗就自動停住，不會像上次那樣路徑打錯還一路往下跑。

### 4-1 設定 git 身分（只要做一次）

```bash
git config --global user.name "JackySu51"
git config --global user.email "jacky8251@gmail.com"
git config --global --list
```

最後一行會印出你剛填的內容。

### 4-2 確認位置正確（很重要，不要跳過）

```bash
cd ~/Downloads/paynav-taiwan && pwd && ls package.json
```

**必須同時看到兩件事**：路徑結尾是 `/paynav-taiwan`、以及印出 `package.json`。

沒看到就停下來，不要執行下一段。

### 4-3 在 GitHub 網頁建立 repo

1. 到 <https://github.com/new>
2. Repository name 填 `paynav-taiwan`
3. 選 **Private**
4. **下面的 Add README、.gitignore、license 全部不要勾**（勾了會衝突）
5. 按 **Create repository**

### 4-4 推上去

一次貼這整段：

```bash
git init && git add . && git commit -m "第一版：台灣支付導航 MVP" && git branch -M main && git remote add origin https://github.com/JackySu51/paynav-taiwan.git && git push -u origin main
```

正常情況 `git add .` 幾秒就跑完（只有 62 個檔案）。**如果又看到 `Library/...` 的警告，立刻按 `control + C`**，代表位置跑掉了，回到 4-2 重新確認。

第一次 push 會跳出瀏覽器要你登入 GitHub 授權，照著點完即可。

**確認成功**：重新整理 GitHub 頁面，應該看得到 `src`、`public`、`docs` 這些資料夾。

---

## 步驟 5：接上 Cloudflare Pages

這一步全部在網頁上點，不用打指令。

1. 登入 <https://dash.cloudflare.com>（你的帳號 `jacky8251@gmail.com`）
2. 左邊 **Workers & Pages** → **Create** → 切到 **Pages** → **Connect to Git**
3. 授權 Cloudflare 讀取 GitHub（會跳到 GitHub 按 Authorize）
4. 選 `paynav-taiwan` → **Begin setup**
5. 照這張表填：

| 欄位 | 填什麼 |
| --- | --- |
| Project name | `paynav-taiwan` |
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空 |

6. 展開 **Environment variables**，加一個：`NODE_VERSION` = `20`
7. 按 **Save and Deploy**

等一兩分鐘，看到綠色 Success，網址是 `https://paynav-taiwan.pages.dev`。

**用 iPhone 的 Safari 打開這個網址**（因為是 HTTPS，定位才會正常）→ 按下方分享鍵 → 往下滑選 **加入主畫面**。之後從主畫面開啟就是全螢幕，離線也能用。

---

## 步驟 6：（未來）上架 iOS App Store

Cloudflare Pages 已經是可用網址，iPhone 使用者「加入主畫面」跟原生 App 幾乎一樣，先這樣就好。

想正式上架 App Store 見 `docs/08-iOS-上架.md`。要準備 Apple 開發者帳號（$99/年），第一次打包大約半天，之後每次更新內容只要 `npm run ios:sync`。

---

## 步驟 7：抓真實門市圖資（可選，但建議做）

內建只有 56 個示範點位。要讓「走進店裡自動判斷」真的能用，得抓真實資料：

```bash
cd ~/Downloads/paynav-taiwan
npm run packs:list
npm run packs:build -- tw-taipei
```

第三行會連 OpenStreetMap 抓台北市的連鎖門市，約一兩分鐘。跑完把結果推上去：

```bash
git add . && git commit -m "加入台北市地標包" && git push
```

Cloudflare 會自動重新部署，之後使用者就能在「地標」分頁下載台北市。

其他常用指令：

```bash
npm run packs:build -- tw-newtaipei tw-taichung   # 多個地區
npm run packs:build -- --region TW                # 整個台灣 22 縣市（十幾分鐘）
npm run packs:build -- jp-tokyo kr-seoul          # 東京、首爾
```

---

## 以後怎麼更新

改完檔案（例如更新 `public/data/rules.json` 的回饋數字）：

```bash
cd ~/Downloads/paynav-taiwan
npm run check:rules
git add . && git commit -m "更新 8 月回饋數字" && git push
```

Cloudflare 自己重新部署，一兩分鐘後線上就更新了。

**手機上還是舊的？** 這是 PWA 的正常行為：Service Worker 先給你快取版本，背景抓新版，下次打開才換。想立刻看到，把 App 從主畫面完全關掉再開。

---

## 跟之前的說法有哪些變更

| 項目 | 之前 | 現在 |
| --- | --- | --- |
| 安裝腳本 | `setup-paynav.sh` → `paynav-patch-01/02/03.sh` → `paynav-install-v2.sh` | **只用 `paynav-setup.sh`**，它會自己判斷全新安裝或更新，前面的都不要再用 |
| 安裝位置 | 文件寫 `~/Documents` | **`~/Downloads`**（注意是 `Downloads`，有 s；Finder 顯示「下載」但真實路徑是英文） |
| git 安裝 | 沒提 | 新 Mac 預設沒有 git，要先 `xcode-select --install` |
| git 指令 | 一行一行分開 | **改用 `&&` 串接**，失敗就自動停住 |
| 推上 GitHub 前 | 直接 `git init` | **先 `pwd && ls package.json` 確認位置**，這一步救你避免把家目錄變成 repo |
| GitHub Desktop | 文件建議用 | 不需要，用終端機或 GitHub 網頁上傳都可以 |
| 韓國支付 | 我曾寫「只能靠信用卡」 | **錯的，已更正**：台灣 Pay／悠遊付／icash Pay 走 Paybooc(TWQR)、全支付走 ZeroPay、LINE Pay 指定店家 |
| 卡片數量 | 只能等規則庫收錄 | 皮夾可以**自己新增卡片與規則**，還能匯出備份碼換手機 |
| 地標 | 56 個示範點位 | **34 個可分區下載的地標包**，圖資用 `npm run packs:build` 自己產製 |
| 財政部 API | 已決定不串接 | 個人申請不到（需 ISO 27001，只發給企業組織）。統一發票中獎號碼這個功能整個拿掉了，不做 |

---

## 卡住了怎麼辦

| 訊息 | 原因與解法 |
| --- | --- |
| `cd: no such file or directory` | 路徑錯了。用 Finder 找到資料夾，**直接拖進終端機視窗**，路徑會自動填上 |
| `command not found: git` | 執行 `xcode-select --install` |
| `command not found: npm` | Node.js 沒裝，到 nodejs.org 裝 LTS 版，裝完重開終端機 |
| 一堆 `Library/...: Operation not permitted` | 位置跑掉了，git 在掃家目錄。`control + C` 中斷，回步驟 2 |
| `remote origin already exists` | 之前設過了。執行 `git remote remove origin` 再重跑 4-4 |
| `failed to push some refs` | GitHub 上的 repo 不是空的（建立時勾了 README）。刪掉重建一個空的，記得三個勾選都不要勾 |
| Cloudflare 部署失敗 | 專案頁 → 那次部署 → **View build log**，紅字通常會直接說哪一行 JSON 壞了 |
| 網頁一片空白 | 看終端機有沒有紅字。先 `control + C` 再 `npm run dev` |

---

## 目前的專案內容速查

| 想改什麼 | 檔案 |
| --- | --- |
| 卡片、回饋 %、加碼說明 | `public/data/rules.json` |
| 支付工具的名稱、色彩、可用地區 | `public/data/rules.json` 的 `paymentMethods` |
| 通路清單、門市座標 | `public/data/stores.json` |
| 地標包目錄 | `public/data/packs/index.json` |
| 要監控哪些優惠頁 | `public/data/promo-sources.json` |
| LOGO | `public/favicon.svg` |
| 配色 | `src/index.css` 最上面的 `:root` |

文件在 `docs/` 底下，`00` 到 `09`：上手、部署、自動更新機制、功能藍圖、優惠監控、日韓海外、地標包、商業性評估、iOS 上架、資安文件維護規則。
