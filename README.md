# NTUBAstat — 臺大棒球隊數據平台

紀錄員用手機逐球紀錄，送出就自動算好所有數據；教練、隊員、校友打開網站就能看即時比分、比賽紀錄與個人成績。

系統源自 NTU BaFiN 系隊的 [bafinstat](https://github.com/alanwu14832-bit/bafinstat)，這裡是校隊獨立的一份：自己的資料庫、自己的網站、自己的網址。

| 要做的事 | 看這份 |
|---|---|
| 第一次架設（資料庫、網站、網域） | [docs/SETUP.md](docs/SETUP.md) |
| 日常維護、改功能、換屆交接、故障排除 | [docs/HANDOVER.md](docs/HANDOVER.md) |
| 紀錄員與隊員怎麼用網站 | [docs/USER_GUIDE.md](docs/USER_GUIDE.md)（網站的「使用指南」頁也有） |
| 用 Claude 改程式時的規則 | [CLAUDE.md](CLAUDE.md) |

## 架構

| 部分 | 放在哪 |
|---|---|
| 程式碼 | 這個 GitHub repo（`web/` 是網站） |
| 資料庫 | Supabase 免費方案（`supabase/schema.sql`） |
| 網站 | Cloudflare Pages，接這個 repo 的 `main` 自動更新 |
| 自動化 | `.github/workflows/`：測試通過自動上線、每 3 天讓資料庫保持清醒、每週備份 |

## 本機開發

```
cd web
npm ci
npm run dev      # 本機預覽
npm test         # 測試
npm run build    # 建置
```

隊名、局數等設定在 `web/src/config/teamDefaults.ts`；隊徽放 `web/public/mark.png`（正方形）與 `web/public/logo.png`。
