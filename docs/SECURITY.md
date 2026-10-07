# 資料安全制度

給管理員與紀錄員。這份講：資料怎麼被保護、誰能做什麼、出事時怎麼處理。

## 1. 要保護什麼

比賽成績本來就公開，任何人都能看；要保護的是**寫入權**和**紀錄員的帳號**。最嚴重的情況是：有人取得寫入權後竄改或刪光資料，或把自己加成紀錄員。

## 2. 現在的防護

| 層 | 機制 | 說明 |
|---|---|---|
| 網站 | Cloudflare 靜態託管、HTTPS、安全標頭（`web/public/_headers`） | 沒有自己的伺服器；禁止被別的網站嵌入（防點擊劫持）、HSTS、nosniff、Referrer／Permissions-Policy |
| 腳本 | Content-Security-Policy（`web/src/config/security.ts`，建置時寫進 `index.html`） | 只執行本站自己的程式（禁止內嵌與注入的腳本、禁止 eval）；資料只能送往本站與自己的 Supabase 專案 |
| 資料庫 | Supabase Postgres + Row Level Security | **任何人可讀**；**只有「已啟用的紀錄員帳號」可寫**（`is_editor()` 比對登入帳號本身，不只是 email） |
| 帳號啟用 | `supabase/migrations/2026-10-08_security.sql` | 紀錄員名單上的 email 要用**邀請碼**（或寄到該信箱的驗證碼）啟用到一個帳號才能寫。光是用某人的 email 註冊帳號，什麼都寫不了 |
| 邀請碼 | 10 碼、7 天有效、只存雜湊值 | 輸錯 10 次鎖住；用過即失效；紀錄員也讀不到；啟用時一併設定新密碼並登出其他裝置 |
| 金鑰 | 前端只有 anon（publishable）key | 權限完全由 RLS 決定；匿名角色另外被收回所有寫入權；`service_role` key 永遠不放前端、不進 git（已掃過整個 git 歷史，沒有外洩） |
| 個資 | 公開表格不存 email | `updated_by`／`created_by` 由資料庫自動填紀錄員名單上的備註名稱，舊資料裡的 email 已換掉 |
| 稽核 | `audit_log`（只有紀錄員讀得到） | 比賽、球員、報名名單、相簿、紀錄員名單的每次新增／修改／刪除：時間、帳號、哪一筆；刪除會保留整列內容 |
| 資料上限 | 資料庫 check constraint | 相簿連結必須是 http(s)；備註、逐球、進行中紀錄有大小上限 |
| 備份 | GitHub Actions「每日備份資料」 | 每天一份（JSON），保留 30 天 |
| 套件 | `npm audit` 0 個漏洞 | Excel 套件升級到 SheetJS 0.20.3（修掉兩個高風險漏洞） |

網站把「紀錄比賽」「資料匯入」藏起來只是介面上的方便，**真正的防線是資料庫**：就算有人繞過網站直接打 API，也寫不進去。

## 3. 管理員要做的設定（一次）

1. **執行 `supabase/migrations/2026-10-08_security.sql`**（Supabase → SQL Editor 全部貼上 → Run）。最後會列出紀錄員名單：`bound_via` 是 `existing` 的，是「這次自動啟用的舊帳號」，請確認每一個都是本人；不是的話在紀錄員名單按他的「重發邀請碼」。
2. **Authentication → Sign In / Providers → Email**：Minimum password length 設 **8**（「第一次使用」需要開放註冊；不用擔心，沒有邀請碼的帳號只能瀏覽）。
3. **URL Configuration**：Site URL 與 Redirect URLs 只留自己的網址。
4. **Advisors → Security Advisor**：按 Refresh，應該沒有紅色項目；有的話把畫面給 Claude 看。
5. **兩步驟驗證**：Supabase、Cloudflare、GitHub、共用 Gmail 全部開 2FA。
6. **GitHub Actions 變數**：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（每日備份與保持清醒會用）。

## 4. 人員與權限

| 角色 | 能做什麼 | 怎麼給 | 怎麼收 |
|---|---|---|---|
| 瀏覽者 | 看所有頁面 | 不用做任何事 | — |
| 紀錄員 | 紀錄、修改、刪除比賽，管理紀錄員名單 | 紀錄員名單 → 新增 → 把邀請碼私下傳給對方 | 紀錄員名單 → 移除（立即失效） |
| 管理員 | 上述全部 + Supabase／Cloudflare／GitHub 後台 | 邀請進 Supabase 組織 | 每學期檢查成員，卸任立刻移除 |

- 邀請碼請**私下**傳（不要貼在群組或公告）。
- 管理員也可以在 SQL Editor 發邀請碼：`select admin_issue_editor_code('對方email');`

## 5. 出事時怎麼處理

| 情境 | 處理 |
|---|---|
| 紀錄員忘記密碼 | 見 [HANDOVER.md](HANDOVER.md)「紀錄員 → 忘記密碼」 |
| 懷疑某個紀錄員帳號被盜 | ① 紀錄員名單按他的「重發邀請碼」（那個帳號立刻失去寫入權）② Supabase → Table Editor → `audit_log` 依時間看改了什麼 ③ 用每日備份還原（備份檔交給 Claude）④ 本人用新邀請碼重新啟用 |
| 資料被大量刪除 | 先移除可疑帳號，再用前一天的每日備份還原；`audit_log` 的刪除紀錄保留了比賽本身的內容 |
| 懷疑金鑰外洩 | anon key 本來就公開，不用處理；`service_role` key 外洩時到 Supabase → Settings → API 重設，並檢查 `audit_log` |

## 6. 個資

球員姓名與背號是個資。只放比賽相關資料（姓名、背號、守位、成績），不放電話、學號、生日；備註欄也一樣。新隊員入隊時告知資料會公開在隊上網站；有人要求下架就從球員名單移除。
