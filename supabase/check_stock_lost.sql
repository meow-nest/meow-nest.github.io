-- 查詢用（只讀，不會改資料）：找股票帳戶不見的人
-- 「現在的帳號」：最近 1 天新建的股票帳戶，和這個人加入小窩的時間（兩個時間很接近＝換手機或重新加入）
-- 「被刪掉的舊帳號」：帳戶已經被刪、但交易紀錄還在的舊帳號（交易紀錄保留 30 天）
select '現在的帳號' as 類型, m.name as 名字, m.created_at as 加入或第一筆, a.created_at as 帳戶建立或最後一筆,
  (select count(*) from stock_trades t where t.user_id = m.user_id) as 交易筆數
from stock_acct a join members m on m.user_id = a.user_id
where a.created_at > now() - interval '1 day'
union all
select '被刪掉的舊帳號', left(t.user_id::text, 8), min(t.at), max(t.at), count(*)
from stock_trades t
where not exists (select 1 from stock_acct a where a.user_id = t.user_id) and t.at > now() - interval '3 days'
group by t.user_id
order by 1, 4 desc;
