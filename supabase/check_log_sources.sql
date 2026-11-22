-- 查「日誌擷取」用量主要是哪一種紀錄（最近 24 小時各有幾筆）
-- 注意：這個不是貼在 SQL Editor，是貼在 Logs Explorer（日誌瀏覽器）執行
select 'API 連線' as kind, count(*) as n from edge_logs where timestamp > timestamp_sub(current_timestamp(), interval 1 day)
union all select '資料庫', count(*) from postgres_logs where timestamp > timestamp_sub(current_timestamp(), interval 1 day)
union all select '即時連線', count(*) from realtime_logs where timestamp > timestamp_sub(current_timestamp(), interval 1 day)
union all select '登入', count(*) from auth_logs where timestamp > timestamp_sub(current_timestamp(), interval 1 day)
union all select '推播函數', count(*) from function_edge_logs where timestamp > timestamp_sub(current_timestamp(), interval 1 day)
order by n desc
