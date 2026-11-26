-- 唯讀檢查：站長小窩每個人的推播訂閱（不會改任何資料）
-- 看站長自己的手機有沒有登記到通知、登記的是哪種手機、什麼時候登記的
select m.name as 暱稱,
  count(s.endpoint) as 訂閱數,
  coalesce(string_agg(case when s.endpoint like '%fcm.googleapis.com%' then 'Android' when s.endpoint like '%push.apple.com%' then 'iPhone' else '其他' end, '、'), '沒有登記') as 手機,
  to_char(max(s.created_at) at time zone 'Asia/Taipei', 'MM/DD HH24:MI') as 最近登記時間,
  sum(case when s.couple_id <> m.couple_id then 1 else 0 end) as 小窩對不上
from public.members m
join public.couples k on k.id = m.couple_id and k.is_owner
left join public.push_subs s on s.user_id = m.user_id
group by m.name, m.user_id
order by m.name;
