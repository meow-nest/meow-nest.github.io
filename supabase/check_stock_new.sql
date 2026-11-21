-- 查詢用（只讀，不會改資料）：最近 3 天開始玩股票的人，是老成員第一次玩，還是剛加入（換手機／重新加入／新用戶）
select m.name, m.created_at as 加入小窩, a.created_at as 開始玩股票,
  case when m.created_at > a.created_at - interval '10 minutes'
       then '剛加入（新手機/重加入/新用戶）' else '老成員第一次玩' end as 判斷
from stock_acct a
join members m on m.user_id = a.user_id
where a.created_at > now() - interval '3 days'
order by a.created_at desc;
