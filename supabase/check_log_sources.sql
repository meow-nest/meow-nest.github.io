-- 查「日誌擷取」用量主要是哪一種紀錄（各有幾筆）
-- 注意：這個不是貼在 SQL Editor，是貼在 Logs Explorer（日誌瀏覽器）執行；上面的時間範圍選最長的（例如 Last 24 hours）
select 'API 連線' as kind, count(*) as n from edge_logs
union all select '資料庫', count(*) from postgres_logs
union all select '即時連線', count(*) from realtime_logs
union all select '登入', count(*) from auth_logs
union all select '推播函數', count(*) from function_edge_logs
limit 10
