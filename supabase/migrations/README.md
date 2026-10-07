# 資料庫修改紀錄

新的 Supabase 專案只要在 SQL Editor 執行一次 `supabase/schema.sql`，不用跑這裡的檔案。

之後如果新功能要改資料庫（加欄位、加資料表），Claude 會把修改寫成這裡的一個新檔案（檔名用日期開頭），
同時更新 `schema.sql`。已經在用的資料庫要到 Supabase → SQL Editor 貼上那個新檔案執行一次。
