# 第一次架設（約 30–60 分鐘）

照順序做完，網站就能用。所有帳號都用**校隊共用 Gmail** 註冊，只有 GitHub repo 在維護者自己的帳號下（交接時再轉給校隊，見 [HANDOVER.md](HANDOVER.md)）。

## 0. 先準備

- 校隊共用 Gmail（復原手機與信箱不要綁個人，備用碼印出來交接用）
- 管理員的 email（第一位紀錄員，之後由他在網站上新增其他人）
- 隊徽：正方形一張、完整 logo 一張（PNG）

## 1. 資料庫（Supabase）

1. 到 [supabase.com](https://supabase.com) 用共用 Gmail 登入 → **New project**
   - Name：`ntubastat`；Region：**Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**
   - Database password：自己產生一組，存在共用 Gmail 的雲端硬碟（平常用不到）
2. 左側 **SQL Editor** → **New query** → 把 `supabase/schema.sql` 全部貼上
   - 把裡面的 `改成管理員的email@gmail.com` 改成管理員的 email（搜尋「改成管理員」）
   - 按 **Run**：下方結果會顯示管理員的 **邀請碼**（10 碼），抄下來，第 7 步會用到（7 天內有效）
3. 左側 **Authentication** → **Sign In / Providers**
   - **Allow new users to sign up**：開啟（紀錄員要自己設定密碼；沒有邀請碼的帳號只能瀏覽，不能寫入）
   - **Email** → **Confirm email**：關閉（免費方案寄信有限制，紀錄員會收不到確認信；安全靠邀請碼，不靠確認信）
   - **Email** → **Minimum password length**：設 **8**
   - **URL Configuration** → Site URL 與 Redirect URLs 只填自己的網址（例如 `https://ntubtstat.mbaw.workers.dev`）
4. 左側 **Project Settings** → **API**（或 **API Keys**），記下兩個值：
   - **Project URL**（`https://xxxx.supabase.co`）
   - **anon public** key（新版介面叫 publishable key，兩者都可以）

## 2. 網站（Cloudflare Workers）

Cloudflare 現在建立網站預設是 Workers（以前叫 Pages），兩者都免費、都允許商業使用；這個 repo 用 Workers（設定在 `web/wrangler.jsonc`）。

1. 到 [dash.cloudflare.com](https://dash.cloudflare.com) 用共用 Gmail 註冊並登入
2. **Workers & Pages** → **Create** → **Import a repository**
   - 授權 GitHub 時用**維護者自己的 GitHub 帳號**登入，只勾選 `ntubastat` 這個 repo
   - Project name 填 `ntubtstat`（要和 `web/wrangler.jsonc` 的 `name` 一樣）
3. 建置設定（建立後也可以在 **Settings** → **Build** → **Build configuration** 修改）：

   | 欄位 | 填 |
   |---|---|
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory（Path） | `web` |
   | Production branch | `main` |

4. **Build variables**（同一頁往下，或 **Settings** → **Build** → **Variables and secrets**；要放在 Build 這一區，網站建置時才讀得到）：

   | 名稱 | 值 |
   |---|---|
   | `VITE_SUPABASE_URL` | 第 1 步的 Project URL |
   | `VITE_SUPABASE_ANON_KEY` | 第 1 步的 anon / publishable key |
   | `NODE_VERSION` | `22` |

5. **Deploy**（之後改設定要到 **Deployments** 按 **Retry build**）。約兩分鐘後得到網址 `https://ntubtstat.<你的帳號>.workers.dev`（目前是 `https://ntubtstat.mbaw.workers.dev`）。

> 有收費就是商業用途，Vercel 免費方案不能用；Cloudflare 免費方案沒有這個限制。

## 3. 網址（選用，建議）

1. Cloudflare 左側 **Domain Registration** → **Register Domains**，搜尋想要的名字
2. 購買時年數選 **10 年**（之後不用管續約），自動續約也打開
3. 回到 **Workers & Pages** → 這個專案 → **Settings** → **Domains & Routes** → **Add** → **Custom domain**，填剛買的網址

## 4. 登入轉址（Supabase）

**Authentication** → **URL Configuration**：

- **Site URL**：網站網址（有買網域就填網域，例如 `https://ntubaseball.com`）
- **Redirect URLs** 加上：`https://ntubtstat.<你的帳號>.workers.dev/**`，有網域的話再加 `https://你的網域/**`

## 5. GitHub 自動化

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **Variables** 分頁 → **New repository variable**，新增兩個（和第 2 步一樣的值）：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. **Actions** 分頁：如果顯示要啟用 workflows，按啟用
3. 左側選 **讓資料庫保持清醒** → **Run workflow** 跑一次，綠勾代表設定正確；**每日備份資料** 也可以手動跑一次確認

這三個自動化：

| 名稱 | 做什麼 |
|---|---|
| 測試通過就自動上線 | Claude 把修改推到 `claude/` 開頭的分支 → 跑測試 → 通過就合併進 `main` → Cloudflare 自動更新網站 |
| 讓資料庫保持清醒 | 每 3 天讀一筆資料，免費資料庫才不會因為休賽季沒人用而暫停 |
| 每日備份資料 | 每天把所有比賽資料存成 JSON，放在 Actions 的 Artifacts，保留 30 天 |

## 6. 隊名與隊徽

把隊徽交給 Claude（或自己放到 `web/public/mark.png` 正方形、`web/public/logo.png` 完整版），並確認 `web/src/config/teamDefaults.ts`：

- `name`：**比賽紀錄上「我隊」的寫法**，Excel 匯入時靠它分辨哪一隊是我們
- `org` / `short`：網站側欄與手機主畫面顯示的名稱
- `innings`：幾局制（ERA 換算與新比賽預設）

## 7. 驗收

1. 打開網站 → **資料匯入** → 登入框選 **第一次使用** → 輸入管理員 email、第 1 步拿到的**邀請碼**，設定密碼
2. 登入後右側出現 **紀錄員名單** → 新增其他紀錄員的 email；每新增一位會出現他的邀請碼，私下傳給他
3. **紀錄比賽** 頁開一場練習賽，記幾個打席 → **即時比分** 頁看得到 → 結束比賽 → **比賽** 頁看得到成績
4. 測完把練習賽刪掉（比賽頁打開那場 → 垃圾桶）
