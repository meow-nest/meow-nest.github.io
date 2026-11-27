-- 唯讀檢查：為什麼有人建不了小窩（不會改任何資料，不會顯示任何人的名字）
-- 看最近 48 小時每 3 小時：新登入的帳號、新建的小窩、登入了但沒進任何小窩的帳號
-- 如果「新登入」有、「新小窩」一直是 0 → 建立那一步壞了；如果兩個都是 0 → 登入那一步就被擋了
with h as (
  select generate_series(date_trunc('hour', now() at time zone 'Asia/Taipei') - interval '45 hours',
                         date_trunc('hour', now() at time zone 'Asia/Taipei'), interval '3 hours') as t
)
select '時段（台灣）' as 項目, to_char(h.t, 'MM/DD HH24:00') || ' 起 3 小時' as 時段,
  (select count(*) from auth.users u where (u.created_at at time zone 'Asia/Taipei') >= h.t and (u.created_at at time zone 'Asia/Taipei') < h.t + interval '3 hours')::text as 新登入帳號,
  (select count(*) from public.couples c where (c.created_at at time zone 'Asia/Taipei') >= h.t and (c.created_at at time zone 'Asia/Taipei') < h.t + interval '3 hours')::text as 新小窩,
  (select count(*) from auth.users u where (u.created_at at time zone 'Asia/Taipei') >= h.t and (u.created_at at time zone 'Asia/Taipei') < h.t + interval '3 hours'
     and not exists (select 1 from public.members m where m.user_id = u.id))::text as 登入但沒進小窩
from h
union all
select '設定', '小窩上限', coalesce((select value::text from public.app_settings where key = 'max_couples'), '沒設'),
  (select count(distinct couple_id)::text from public.members), '←目前有人的小窩數'
union all
select '設定', '最後一個新小窩', coalesce(to_char((select max(created_at) from public.couples) at time zone 'Asia/Taipei', 'MM/DD HH24:MI'), '沒有'), '', ''
union all
select '設定', '最後一個新帳號', coalesce(to_char((select max(created_at) from auth.users) at time zone 'Asia/Taipei', 'MM/DD HH24:MI'), '沒有'), '', ''
order by 1 desc, 2;
