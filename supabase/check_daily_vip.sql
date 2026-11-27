-- 唯讀檢查：VIP 小窩（不含站長小窩）的人今天有沒有打卡（不會改任何資料）
-- 「今天」跟網站一樣：台灣時間凌晨 4 點換日。顯示每個人今天說早安／晚安的時間，和最近一次打卡訊息。
with k as (
  select to_char((now() at time zone 'Asia/Taipei') - interval '4 hours', 'FMYYYY-FMMM-FMDD') as dk
)
select c.code as 邀請碼, m.name as 暱稱,
  coalesce(to_char(to_timestamp((g.state->'days'->k.dk->'m'->>m.user_id::text)::bigint / 1000.0) at time zone 'Asia/Taipei', 'HH24:MI'), '還沒') as 今天早安,
  coalesce(to_char(to_timestamp((g.state->'days'->k.dk->'n'->>m.user_id::text)::bigint / 1000.0) at time zone 'Asia/Taipei', 'HH24:MI'), '還沒') as 今天晚安,
  (select to_char(max(x.created_at) at time zone 'Asia/Taipei', 'MM/DD HH24:MI') from public.messages x where x.couple_id = c.id and x.sender = m.user_id and x.kind = 'greet') as 最近一次打卡訊息,
  (select count(*) from public.members y where y.couple_id = c.id) as 小窩人數
from public.couples c
cross join k
join public.members m on m.couple_id = c.id
left join public.game_state g on g.couple_id = c.id and g.game = 'daily'
where c.vip and not c.is_owner
order by c.created_at, m.created_at;
