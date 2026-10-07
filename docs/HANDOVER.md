# 維護與交接

平常不用管：網站、資料庫、備份都會自己運作。要改功能或出問題時看這份。

## 帳號一覽

| 東西 | 在哪 | 帳號 |
|---|---|---|
| 程式碼 | GitHub `ntubastat` repo | 維護者（交接時轉給校隊） |
| 資料庫 | supabase.com | 校隊共用 Gmail |
| 網站、網址 | dash.cloudflare.com | 校隊共用 Gmail |
| 紀錄員名單 | 網站「資料匯入」頁 | 名單內的紀錄員都能管理 |

## 改功能（用 Claude）

1. 在 Claude（Claude Code）開一個新對話，選這個 repo
2. 用中文說要改什麼，例如「比賽頁加一欄對手先發投手」
3. Claude 改好、跑完測試，推到 `claude/` 開頭的分支
4. GitHub 的「測試通過就自動上線」會合併進 `main`，Cloudflare 約兩分鐘後更新網站

測試沒過就不會上線，網站維持原樣；請 Claude 看 Actions 的錯誤再修。

### 改到資料庫時

Claude 會在 `supabase/migrations/` 多一個檔案並告訴你。到 Supabase → **SQL Editor** 貼上那個檔案執行一次。執行前網站照常可用，只是新功能的資料存不進雲端（網站會提示）。

### 想要系隊版的新功能

在這個 repo 的 Claude 對話裡說：「把 bafinstat 的某某功能搬過來」，並把 bafinstat 加進對話。

## 紀錄員

- **新增**：任一位紀錄員到「資料匯入」→ 紀錄員名單 → 輸入 email → 新增 → 畫面出現一組 **10 碼邀請碼**（只顯示這一次，7 天內有效），私下傳給對方；對方在登入框選「第一次使用」輸入 email、邀請碼並設定密碼。**沒有邀請碼，就算有人先用這個 email 註冊也寫不進資料**
- **移除**：同一個地方按移除（不能移除自己，所以名單不會空掉），立即失去寫入權
- **忘記密碼**：
  1. 管理員到 Supabase → **Authentication** → **Users** 找到那個 email → 刪除帳號
  2. 任一位紀錄員在紀錄員名單按他的「**重發邀請碼**」，把新的邀請碼傳給他
  3. 對方重新用「第一次使用」輸入 email、新邀請碼並設定新密碼
- **懷疑帳號被盜**：在紀錄員名單按那個人的「重發邀請碼」（被盜的帳號立刻失去寫入權），再照上面「忘記密碼」重新啟用；到 Supabase → Table Editor → `audit_log` 查被改了什麼，用每日備份還原。完整說明見 [SECURITY.md](SECURITY.md)

## 備份與還原

- 每天自動備份：GitHub → **Actions** → **每日備份資料** → 點一次執行 → 下方 **Artifacts** 下載
- 也可以隨時在網站「資料匯入」→ **匯出備份（總表格式）**
- 要還原時把備份檔交給 Claude，說「用這份備份把資料寫回資料庫」

## 換屆交接清單

- [ ] 共用 Gmail 的密碼、備用碼交給下一屆；**Gmail 至少每 2 年要登入一次**，否則 Google 會刪除帳號
- [ ] 新幹部的 email 加進紀錄員名單，畢業的人移除
- [ ] 維護者不再負責時：GitHub repo → **Settings** → 最下方 **Transfer ownership** → 轉給校隊的 GitHub 帳號；之後到 Cloudflare 專案 **Settings** → **Builds** 重新連結 repo
- [ ] 網址到期日：Cloudflare → **Domain Registration** 查看；買 10 年的話第 9 年記得延長

## 故障排除

| 狀況 | 原因與處理 |
|---|---|
| 網站打得開，但沒有任何資料、一直載入中 | 免費資料庫暫停了（連續 7 天沒人讀）。到 Supabase 專案頁按 **Restore**，資料不會不見。之後到 GitHub Actions 確認「讓資料庫保持清醒」是綠勾 |
| 「讓資料庫保持清醒」紅叉 | 多半是 GitHub Variables 沒設或填錯（見 SETUP.md 第 5 步） |
| 紀錄員登入後還是不能紀錄 | email 不在紀錄員名單，或大小寫、拼字不同；請現有紀錄員重新新增 |
| 「第一次使用」說需要信箱確認 | Supabase 的 **Confirm email** 沒關（見 SETUP.md 第 1 步） |
| 改了程式但網站沒變 | GitHub Actions 的「測試通過就自動上線」失敗，或 Cloudflare 建置失敗（Cloudflare 專案 → **Deployments** 看紀錄） |
| 網址打不開，但 `xxx.workers.dev` 可以 | 網域到期或 DNS 設定被改；到 Cloudflare **Domain Registration** 與 **Custom domains** 檢查 |

## 費用

- Supabase、Cloudflare、GitHub：免費方案就夠
- 網域：.com 約 NT$350／年（建議一次買 10 年）
- 使用量變很大（資料庫 500 MB、每月流量 5 GB）時，Supabase 可隨時升級 Pro（US$25／月），資料不用搬
